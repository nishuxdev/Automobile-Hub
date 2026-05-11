$(document).ready(function () {
    const token = localStorage.getItem('access_token');
    let currentBookingId = null;
    let currentUserId = null;
    let currentMechanicName = null;

    // Initial loads
    fetchStats();
    fetchActiveBooking();
    loadProfile();

    // Fetch current user ID for chat
    $.ajax({
        url: '/auth/me/', type: 'GET',
        headers: { 'Authorization': 'Bearer ' + token },
        success: function (u) { currentUserId = u.id; }
    });

    // ─────────────── Navigation ───────────────
    $('.nav-link').click(function (e) {
        e.preventDefault();
        const sectionId = $(this).attr('id').replace('link-', 'section-');
        switchToSection(sectionId);
    });

    window.switchToSection = function (sectionId) {
        $('.nav-link').removeClass('active');
        $(`#link-${sectionId.replace('section-', '')}`).addClass('active');
        $('.dashboard-section').hide();
        $(`#${sectionId}`).fadeIn(300);

        if (sectionId === 'section-dashboard') { fetchStats(); fetchActiveBooking(); }
        else if (sectionId === 'section-bookings') { fetchBookings(); }
        else if (sectionId === 'section-ratings') { fetchUnratedBookings(); }
        else if (sectionId === 'section-profile') { loadProfile(); }
    };

    // ─────────────── Stats ───────────────
    function fetchStats() {
        $.ajax({
            url: '/auth/customer/stats/', type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function (d) {
                $('#stat-total').text(d.total_bookings);
                $('#stat-active').text(d.active_bookings);
                $('#stat-completed').text(d.completed_bookings);
                $('#stat-cancelled').text(d.cancelled_bookings);
            }
        });
    }

    function fetchActiveBooking() {
        $.ajax({
            url: '/auth/customer/bookings/?status=PAID', type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function (resp) {
                const bookings = resp.results || resp;
                const area = $('#active-booking-content');
                if (!bookings || bookings.length === 0) {
                    // Try other active statuses
                    $.ajax({
                        url: '/auth/customer/bookings/', type: 'GET',
                        headers: { 'Authorization': 'Bearer ' + token },
                        success: function (r2) {
                            const all = r2.results || r2;
                            const active = all.filter(b => ['PENDING','ASSIGNED','PAID','ON_THE_WAY','IN_PROGRESS'].includes(b.status));
                            if (active.length > 0) renderActiveCard(active[0], area);
                            else area.html('<div class="empty-state-container"><div class="empty-icon">🏍️</div><div class="empty-title">No active bookings</div><div class="empty-desc">Book a motorcycle service to get started!</div><button class="btn-primary-glow" onclick="switchToSection(\'section-book\')">Book a Service</button></div>');
                        }
                    });
                    return;
                }
                renderActiveCard(bookings[0], area);
            }
        });
    }

    function renderActiveCard(b, area) {
        const statusSteps = ['PENDING','ASSIGNED','PAID','ON_THE_WAY','IN_PROGRESS','COMPLETED'];
        const idx = statusSteps.indexOf(b.status);
        let timeline = '<div class="status-tracker">';
        statusSteps.forEach((s, i) => {
            const cls = i < idx ? 'completed' : (i === idx ? 'current' : '');
            const lineCls = i < idx ? 'completed' : '';
            timeline += `<div class="track-step"><div class="d-flex flex-column align-items-center"><div class="track-dot ${cls}"></div><div class="track-label">${s.replace(/_/g,' ')}</div></div></div>`;
            if (i < statusSteps.length - 1) timeline += `<div class="track-line ${lineCls}"></div>`;
        });
        timeline += '</div>';

        area.html(`
            <div class="booking-card">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <div class="fw-bold fs-5">Booking #${b.id}</div>
                        <div class="text-dim small">${b.service_details}</div>
                    </div>
                    <span class="badge-status badge-${b.status}">${b.status.replace(/_/g,' ')}</span>
                </div>
                ${timeline}
                <div class="row mt-3">
                    <div class="col-6"><div class="stat-label">Mechanic</div><div class="fw-semibold">${b.mechanic ? b.mechanic.name : 'Not assigned'}</div></div>
                    <div class="col-6"><div class="stat-label">Amount</div><div class="fw-semibold text-success">₹${b.total_amount}</div></div>
                </div>
                ${b.service_otp ? `<div class="mt-3 p-3 rounded" style="background:rgba(99,102,241,0.1);"><div class="stat-label">Service OTP</div><div class="fw-bold fs-4 text-accent">${b.service_otp}</div></div>` : ''}
                ${b.mechanic ? `<div class="mt-3"><button class="chat-fab" onclick="ChatWidget.open(${b.id}, '${b.mechanic.name}', ${currentUserId})">💬 Chat with Mechanic</button></div>` : ''}
            </div>
        `);
    }

    // ─────────────── Booking Flow ───────────────
    let bookingStep = 1;

    window.goToStep = function (step) {
        if (step === 2) {
            if (!$('#book-service-type').val()) return alert('Please select a service type.');
            if (!$('#book-description').val()) return alert('Please describe the issue.');
        }
        bookingStep = step;
        $('[id^="booking-step-"]').hide();
        $(`#booking-step-${step}`).fadeIn(300);
        updateStepIndicator(step);
    };

    function updateStepIndicator(step) {
        for (let i = 1; i <= 4; i++) {
            const circle = $(`#step-${i}`);
            circle.removeClass('active done');
            if (i < step) circle.addClass('done');
            else if (i === step) circle.addClass('active');
            if (i < 4) {
                const line = $(`#line-${i}-${i + 1}`);
                line.toggleClass('done', i < step);
            }
        }
    }

    window.detectLocation = function () {
        const btn = $('#detect-location-btn');
        btn.text('Detecting...').prop('disabled', true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    $('#book-lat').val(pos.coords.latitude.toFixed(6));
                    $('#book-lon').val(pos.coords.longitude.toFixed(6));
                    btn.text('✅ Location Detected').prop('disabled', false);
                },
                function () {
                    alert('Location access denied. Please enter coordinates manually.');
                    btn.text('📍 Detect My Location').prop('disabled', false);
                }
            );
        } else {
            alert('Geolocation not supported by your browser.');
            btn.text('📍 Detect My Location').prop('disabled', false);
        }
    };

    window.createBookingAndSearch = function () {
        const location = $('#book-location').val();
        const lat = $('#book-lat').val();
        const lon = $('#book-lon').val();
        if (!location) return alert('Please enter your address.');
        if (!lat || !lon) return alert('Please enter or detect your coordinates.');

        const serviceType = $('#book-service-type').val();
        const description = $('#book-description').val();
        const serviceDetails = `${serviceType}: ${description}`;

        // Create booking first
        $.ajax({
            url: '/auth/customer/bookings/create/', type: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify({
                service_details: serviceDetails,
                bike_model: $('#book-bike-model').val() || '',
                location: location,
                latitude: parseFloat(lat),
                longitude: parseFloat(lon)
            }),
            success: function (booking) {
                currentBookingId = booking.id;
                searchMechanics(lat, lon, $('#book-radius').val() || 25);
            },
            error: function (xhr) {
                alert('Failed to create booking: ' + JSON.stringify(xhr.responseJSON));
            }
        });
    };

    function searchMechanics(lat, lon, radius) {
        $.ajax({
            url: `/auth/customer/nearby-mechanics/?lat=${lat}&lon=${lon}&radius=${radius}`,
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function (mechanics) {
                renderMechanicCards(mechanics);
                goToStep(3);
            },
            error: function () { alert('Failed to search mechanics.'); }
        });
    }

    function renderMechanicCards(mechanics) {
        const container = $('#mechanics-list');
        container.empty();
        if (!mechanics || mechanics.length === 0) {
            container.html('<div class="empty-state-container"><div class="empty-icon">🔍</div><div class="empty-title">No mechanics found nearby</div><div class="empty-desc">Try increasing the search radius or check back later.</div></div>');
            return;
        }
        mechanics.forEach(m => {
            const services = (m.services || []).filter(s => s.is_active).map(s => `<span class="service-tag">${s.name} — ₹${s.base_cost}</span>`).join('');
            container.append(`
                <div class="mechanic-card">
                    <div class="mechanic-name">${m.user.name}</div>
                    <div class="mechanic-location">📍 ${m.location || m.address || 'Location not set'} ${m.distance_km != null ? `• ${m.distance_km} km away` : ''}</div>
                    <div class="mechanic-meta">
                        <div class="meta-item">⭐ <span class="meta-value">${parseFloat(m.rating).toFixed(1)}</span></div>
                        <div class="meta-item">🔧 <span class="meta-value">${m.total_jobs}</span> jobs</div>
                        <div class="meta-item">📊 <span class="meta-value">${parseFloat(m.reliability_score).toFixed(0)}%</span> reliable</div>
                    </div>
                    <div class="service-tags">${services || '<span class="text-dim small">No services listed</span>'}</div>
                    <button class="select-btn" onclick="selectMechanic(${m.id})">Select This Mechanic</button>
                </div>
            `);
        });
    }

    window.selectMechanic = function (profileId) {
        if (!currentBookingId) return alert('No active booking found.');
        $.ajax({
            url: `/auth/customer/bookings/${currentBookingId}/select-mechanic/`,
            type: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify({ mechanic_profile_id: profileId }),
            success: function (resp) {
                currentMechanicName = resp.mechanic_name;
                $('#confirm-mechanic-name').text(resp.mechanic_name);
                $('#confirm-service-details').text($('#book-service-type').val() + ' — ' + ($('#book-bike-model').val() || 'N/A'));
                $('#confirm-otp').text(resp.service_otp);
                const pb = resp.price_breakdown;
                $('#confirm-price-breakdown').html(`
                    <div class="price-row"><span class="price-label">Mechanic Cost</span><span>₹${pb.mechanic_cost}</span></div>
                    <div class="price-row"><span class="price-label">Platform Fee</span><span>₹${pb.platform_fee}</span></div>
                    <div class="price-row"><span>Total</span><span>₹${pb.total}</span></div>
                    <div class="mt-3 pt-3" style="border-top: 1px solid var(--border);">
                        <button class="chat-fab w-100 justify-content-center" onclick="ChatWidget.open(${currentBookingId}, '${resp.mechanic_name}', ${currentUserId})">💬 Chat with ${resp.mechanic_name}</button>
                    </div>
                `);
                goToStep(4);
            },
            error: function (xhr) { alert(xhr.responseJSON?.error || 'Failed to select mechanic.'); }
        });
    };

    window.confirmPayment = function () {
        if (!currentBookingId) return;
        $('#confirm-pay-btn').text('Processing...').prop('disabled', true);
        $.ajax({
            url: `/auth/customer/bookings/${currentBookingId}/confirm-payment/`,
            type: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify({}),
            success: function () {
                $('[id^="booking-step-"]').hide();
                $('#booking-step-success').fadeIn(300);
                updateStepIndicator(5);
                fetchStats();
            },
            error: function (xhr) {
                alert(xhr.responseJSON?.error || 'Payment failed.');
                $('#confirm-pay-btn').text('💳 Confirm & Pay').prop('disabled', false);
            }
        });
    };

    window.resetBookingFlow = function () {
        currentBookingId = null;
        bookingStep = 1;
        $('#book-service-type').val('');
        $('#book-bike-model').val('');
        $('#book-description').val('');
        $('#book-location').val('');
        $('#book-lat').val('');
        $('#book-lon').val('');
        $('[id^="booking-step-"]').hide();
        $('#booking-step-1').show();
        updateStepIndicator(1);
        $('#confirm-pay-btn').text('💳 Confirm & Pay').prop('disabled', false);
        $('#detect-location-btn').text('📍 Detect My Location');
    };

    // ─────────────── Bookings List ───────────────
    function fetchBookings() {
        const filter = $('#bookings-filter').val();
        let url = '/auth/customer/bookings/';
        if (filter) url += `?status=${filter}`;
        $.ajax({
            url: url, type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function (resp) {
                const bookings = resp.results || resp;
                const container = $('#bookings-list');
                container.empty();
                if (!bookings || bookings.length === 0) {
                    container.html('<div class="content-section"><div class="empty-state-container"><div class="empty-icon">📋</div><div class="empty-title">No bookings found</div><div class="empty-desc">Your booking history will appear here.</div></div></div>');
                    return;
                }
                bookings.forEach(b => {
                    const actions = [];
                    if (['PENDING', 'ASSIGNED'].includes(b.status)) actions.push(`<button class="btn-action text-danger" onclick="cancelBooking(${b.id})">Cancel</button>`);
                    if (b.status === 'ASSIGNED') actions.push(`<button class="btn-primary-glow btn-sm" onclick="payForBooking(${b.id})">Pay Now</button>`);
                    if (b.status === 'COMPLETED' && !b.has_rating) actions.push(`<button class="btn-action" onclick="openRatingModal(${b.id})">⭐ Rate</button>`);

                    container.append(`
                        <div class="booking-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                    <div class="fw-bold">Booking #${b.id}</div>
                                    <div class="text-dim small">${b.service_details}</div>
                                    ${b.bike_model ? `<div class="text-dim small">🏍️ ${b.bike_model}</div>` : ''}
                                </div>
                                <span class="badge-status badge-${b.status}">${b.status.replace(/_/g, ' ')}</span>
                            </div>
                            <div class="row mt-2">
                                <div class="col-4"><div class="stat-label">Mechanic</div><div class="small">${b.mechanic ? b.mechanic.name : '—'}</div></div>
                                <div class="col-4"><div class="stat-label">Amount</div><div class="small fw-bold">₹${b.total_amount}</div></div>
                                <div class="col-4"><div class="stat-label">Date</div><div class="small">${new Date(b.created_at).toLocaleDateString()}</div></div>
                            </div>
                            <div class="d-flex gap-2 mt-3 flex-wrap">
                                <button class="btn-action" onclick="openBookingDetail(${b.id})">View Details</button>
                                ${actions.join('')}
                                ${b.mechanic && !['COMPLETED','CANCELLED','REJECTED'].includes(b.status) ? `<button class="chat-fab" onclick="ChatWidget.open(${b.id}, '${b.mechanic.name}', ${currentUserId})">💬 Chat</button>` : ''}
                            </div>
                        </div>
                    `);
                });
            }
        });
    }

    $('#bookings-filter').on('change', function () { fetchBookings(); });

    window.openBookingDetail = function (id) {
        $.ajax({
            url: `/auth/customer/bookings/${id}/`, type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function (b) {
                $('#booking-modal-title').text(`Booking #${b.id}`);
                const pb = b.price_breakdown || {};
                $('#booking-modal-content').html(`
                    <div class="row g-3 mb-4">
                        <div class="col-6"><div class="stat-label">Status</div><span class="badge-status badge-${b.status}">${b.status.replace(/_/g,' ')}</span></div>
                        <div class="col-6"><div class="stat-label">Created</div><div>${new Date(b.created_at).toLocaleString()}</div></div>
                        <div class="col-6"><div class="stat-label">Service</div><div>${b.service_details}</div></div>
                        <div class="col-6"><div class="stat-label">Bike</div><div>${b.bike_model || '—'}</div></div>
                        <div class="col-12"><div class="stat-label">Location</div><div>${b.location}</div></div>
                        <div class="col-6"><div class="stat-label">Mechanic</div><div class="fw-semibold">${b.mechanic ? b.mechanic.name : 'Not assigned'}</div></div>
                        <div class="col-6"><div class="stat-label">Total</div><div class="fw-bold text-success fs-5">₹${b.total_amount}</div></div>
                    </div>
                    ${pb.mechanic_cost ? `<div class="price-breakdown"><div class="price-row"><span class="price-label">Mechanic Cost</span><span>₹${pb.mechanic_cost}</span></div><div class="price-row"><span class="price-label">Platform Fee</span><span>₹${pb.platform_fee}</span></div><div class="price-row"><span>Total</span><span>₹${pb.total}</span></div></div>` : ''}
                    ${b.service_otp ? `<div class="mt-3 p-3 rounded" style="background:rgba(99,102,241,0.1);"><div class="stat-label">Service OTP</div><div class="fw-bold fs-4 text-accent">${b.service_otp}</div></div>` : ''}
                    ${b.mechanic && !['COMPLETED','CANCELLED','REJECTED'].includes(b.status) ? `<div class="mt-4"><button class="chat-fab w-100 justify-content-center" onclick="ChatWidget.open(${b.id}, '${b.mechanic.name}', ${currentUserId})">💬 Chat with ${b.mechanic.name}</button></div>` : ''}
                `);
                new bootstrap.Modal(document.getElementById('bookingDetailModal')).show();
            }
        });
    };

    window.cancelBooking = function (id) {
        if (!confirm('Are you sure you want to cancel this booking?')) return;
        $.ajax({
            url: `/auth/customer/bookings/${id}/cancel/`, type: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json', data: '{}',
            success: function () { fetchBookings(); fetchStats(); },
            error: function (xhr) { alert(xhr.responseJSON?.error || 'Cancel failed.'); }
        });
    };

    window.payForBooking = function (id) {
        if (!confirm('Confirm payment for this booking?')) return;
        $.ajax({
            url: `/auth/customer/bookings/${id}/confirm-payment/`, type: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json', data: '{}',
            success: function () { fetchBookings(); fetchStats(); alert('Payment confirmed!'); },
            error: function (xhr) { alert(xhr.responseJSON?.error || 'Payment failed.'); }
        });
    };

    // ─────────────── Ratings ───────────────
    function fetchUnratedBookings() {
        $.ajax({
            url: '/auth/customer/bookings/?status=COMPLETED', type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function (resp) {
                const bookings = (resp.results || resp).filter(b => !b.has_rating);
                const container = $('#unrated-bookings-list');
                container.empty();
                if (bookings.length === 0) {
                    container.html('<div class="text-center py-4 text-dim">No pending reviews. All caught up! 🎉</div>');
                    return;
                }
                bookings.forEach(b => {
                    container.append(`
                        <div class="booking-card">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fw-bold">Booking #${b.id}</div>
                                    <div class="text-dim small">${b.service_details}</div>
                                    <div class="small mt-1">Mechanic: <span class="fw-semibold">${b.mechanic ? b.mechanic.name : '—'}</span></div>
                                </div>
                                <button class="btn-primary-glow" onclick="openRatingModal(${b.id})">⭐ Rate Now</button>
                            </div>
                        </div>
                    `);
                });
            }
        });
    }

    window.openRatingModal = function (bookingId) {
        $('#rating-booking-id').val(bookingId);
        $('input[name="rating"]').prop('checked', false);
        $('#rating-review').val('');
        new bootstrap.Modal(document.getElementById('ratingModal')).show();
    };

    window.submitRating = function () {
        const bookingId = $('#rating-booking-id').val();
        const score = $('input[name="rating"]:checked').val();
        if (!score) return alert('Please select a star rating.');
        $.ajax({
            url: `/auth/customer/bookings/${bookingId}/rate/`, type: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify({ score: parseInt(score), review: $('#rating-review').val() }),
            success: function () {
                const modal = bootstrap.Modal.getInstance(document.getElementById('ratingModal'));
                if (modal) modal.hide();
                fetchUnratedBookings();
                fetchBookings();
                alert('Thank you for your review!');
            },
            error: function (xhr) { alert(xhr.responseJSON?.error || 'Failed to submit rating.'); }
        });
    };

    // ─────────────── Profile ───────────────
    function loadProfile() {
        $.ajax({
            url: '/auth/me/', type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function (user) {
                $('#dashboard-greeting').text(`Welcome back, ${user.name}!`);
                $('#profile-info').html(`
                    <div class="mb-3 p-3 rounded" style="background:rgba(255,255,255,0.03);"><div class="stat-label">Name</div><div class="fw-semibold">${user.name}</div></div>
                    <div class="mb-3 p-3 rounded" style="background:rgba(255,255,255,0.03);"><div class="stat-label">Email</div><div>${user.email}</div></div>
                    <div class="mb-3 p-3 rounded" style="background:rgba(255,255,255,0.03);"><div class="stat-label">Phone</div><div>${user.phone || 'Not provided'}</div></div>
                    <div class="p-3 rounded" style="background:rgba(255,255,255,0.03);"><div class="stat-label">Member Since</div><div>${new Date(user.created_at).toLocaleDateString()}</div></div>
                `);
            }
        });
        $.ajax({
            url: '/auth/customer/stats/', type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function (s) {
                $('#profile-stats').html(`
                    <div class="row g-3">
                        <div class="col-6"><div class="stat-card text-center"><div class="stat-value">${s.total_bookings}</div><div class="stat-label">Total</div></div></div>
                        <div class="col-6"><div class="stat-card text-center"><div class="stat-value" style="color:#818cf8">${s.active_bookings}</div><div class="stat-label">Active</div></div></div>
                        <div class="col-6"><div class="stat-card text-center"><div class="stat-value" style="color:#22c55e">${s.completed_bookings}</div><div class="stat-label">Completed</div></div></div>
                        <div class="col-6"><div class="stat-card text-center"><div class="stat-value" style="color:#f87171">${s.cancelled_bookings}</div><div class="stat-label">Cancelled</div></div></div>
                    </div>
                `);
            }
        });
    }

    // ─────────────── Logout ───────────────
    $('#logout-btn').click(function (e) {
        e.preventDefault();
        localStorage.clear();
        window.location.replace('/login/');
    });
});
