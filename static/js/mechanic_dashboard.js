$(document).ready(function() {
    const token = localStorage.getItem('access_token');
    let currentUserId = null;

    // Fetch current user ID for chat
    $.ajax({
        url: '/auth/me/', type: 'GET',
        headers: { 'Authorization': 'Bearer ' + token },
        success: function (u) { currentUserId = u.id; }
    });

    // Initial loads
    fetchStats();
    fetchJobs();
    fetchServices();
    loadProfile();

    // Navigation logic
    $('.nav-link').click(function(e) {
        e.preventDefault();
        const linkId = $(this).attr('id');
        const sectionId = linkId.replace('link-', 'section-');
        
        switchSection(sectionId);
    });

    function switchSection(sectionId) {
        $('.nav-link').removeClass('active');
        $(`#link-${sectionId.replace('section-', '')}`).addClass('active');
        $('.dashboard-section').hide();
        $(`#${sectionId}`).fadeIn(300);
    }

    function fetchStats() {
        $.ajax({
            url: '/auth/mechanic/earnings/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(data) {
                $('#stat-today-earnings').text('₹' + data.today_earnings);
                $('#stat-jobs-done').text(data.completed_jobs_count);
                $('#stat-total-earnings').text('₹' + data.total_earnings);
                $('#earnings-balance').text('₹' + data.total_earnings); // Simplification
            }
        });
    }

    function fetchJobs() {
        $.ajax({
            url: '/auth/mechanic/jobs/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(response) {
                const jobs = response.results || response;
                renderJobsTables(jobs);
            }
        });
    }

    function renderJobsTables(jobs) {
        const summaryTbody = $('#summary-jobs-table-body');
        const activeTbody = $('#active-jobs-table-body');
        const historyTbody = $('#history-jobs-table-body');

        summaryTbody.empty();
        activeTbody.empty();
        historyTbody.empty();

        const requests = jobs.filter(j => ['ASSIGNED', 'PAID'].includes(j.status));
        const active = jobs.filter(j => ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(j.status));
        const history = jobs.filter(j => j.status === 'COMPLETED');

        // Update active job ID in stats
        if (active.length > 0) {
            $('#active-job-id').text('#' + active[0].id).addClass('text-accent');
        } else {
            $('#active-job-id').text('None').removeClass('text-accent');
        }

        // 1. Summary Table (Requests)
        if (requests.length === 0) {
            summaryTbody.append('<tr><td colspan="4" class="text-center py-4 text-dim">No pending requests</td></tr>');
        } else {
            requests.forEach(req => {
                summaryTbody.append(`
                    <tr>
                        <td>
                            <div class="fw-semibold">${req.service_details}</div>
                            <div class="text-dim small">ID: #${req.id}</div>
                        </td>
                        <td><div class="text-truncate" style="max-width: 200px;">${req.location}</div></td>
                        <td class="text-success fw-bold">₹${req.total_amount}</td>
                        <td>
                            <div class="d-flex gap-2 flex-wrap">
                                <button class="btn-action btn-sm" onclick="updateJobStatus(${req.id}, 'ACCEPTED')">Accept</button>
                                <button class="btn-action btn-sm text-danger" onclick="updateJobStatus(${req.id}, 'REJECTED')">Reject</button>
                                <button class="chat-fab" style="padding:6px 14px; font-size:12px;" onclick="ChatWidget.open(${req.id}, '${req.customer ? req.customer.name : 'Customer'}', ${currentUserId})">💬 Chat</button>
                            </div>
                        </td>
                    </tr>
                `);
            });
        }

        // 2. Active Jobs Table
        if (active.length === 0) {
            activeTbody.append('<tr><td colspan="5" class="text-center py-4 text-dim">No active jobs</td></tr>');
        } else {
            active.forEach(j => {
                activeTbody.append(`
                    <tr>
                        <td><span class="text-accent fw-bold">#${j.id}</span></td>
                        <td>${j.service_details}</td>
                        <td><span class="role-badge" style="background: var(--accent-glow); color: var(--accent);">${j.status.replace(/_/g, ' ')}</span></td>
                        <td><div class="text-truncate" style="max-width: 150px;">${j.location}</div></td>
                        <td>
                            <div class="d-flex gap-2">
                                <button class="btn-action" onclick="openStatusModal(${j.id})">Update Status</button>
                                <button class="chat-fab" style="padding:6px 14px; font-size:12px;" onclick="ChatWidget.open(${j.id}, '${j.customer ? j.customer.name : 'Customer'}', ${currentUserId})">💬 Chat</button>
                            </div>
                        </td>
                    </tr>
                `);
            });
        }

        // 3. History Table
        if (history.length === 0) {
            historyTbody.append('<tr><td colspan="5" class="text-center py-4 text-dim">No history found</td></tr>');
        } else {
            history.forEach(h => {
                historyTbody.append(`
                    <tr>
                        <td>#${h.id}</td>
                        <td>${h.service_details}</td>
                        <td>${new Date(h.created_at).toLocaleDateString()}</td>
                        <td class="text-success">₹${h.total_amount}</td>
                        <td><span class="text-dim small">COMPLETED</span></td>
                    </tr>
                `);
            });
        }
    }

    function fetchServices() {
        $.ajax({
            url: '/auth/mechanic/services/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(response) {
                const services = response.results || response;
                renderServicesTable(services);
            }
        });
    }

    function renderServicesTable(services) {
        const tbody = $('#services-table-body');
        tbody.empty();

        if (services.length === 0) {
            tbody.append('<tr><td colspan="5" class="text-center py-4 text-dim">No services added yet</td></tr>');
        } else {
            services.forEach(s => {
                const statusBadge = s.is_active 
                    ? '<span class="role-badge badge-online">ACTIVE</span>' 
                    : '<span class="role-badge badge-offline">INACTIVE</span>';
                
                tbody.append(`
                    <tr>
                        <td><div class="fw-semibold">${s.name}</div></td>
                        <td><div class="text-dim small text-truncate" style="max-width: 200px;">${s.description || '-'}</div></td>
                        <td>₹${s.base_cost}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <div class="d-flex gap-2">
                                <button class="btn-action btn-sm" onclick="editService(${s.id})">Edit</button>
                                <button class="btn-action btn-sm ${s.is_active ? 'text-warning' : 'text-success'}" onclick="toggleService(${s.id}, ${!s.is_active})">
                                    ${s.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </td>
                    </tr>
                `);
            });
        }
    }

    window.openServiceModal = function() {
        $('#service-id').val('');
        $('#service-form')[0].reset();
        $('#service-modal-title').text('Add New Service');
        new bootstrap.Modal(document.getElementById('serviceModal')).show();
    };

    window.editService = function(id) {
        $.ajax({
            url: `/auth/mechanic/services/${id}/`,
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(s) {
                $('#service-id').val(s.id);
                $('#service-name').val(s.name);
                $('#service-description').val(s.description);
                $('#service-cost').val(s.base_cost);
                $('#service-active').prop('checked', s.is_active);
                $('#service-modal-title').text('Edit Service');
                new bootstrap.Modal(document.getElementById('serviceModal')).show();
            }
        });
    };

    $('#service-form').on('submit', function(e) {
        e.preventDefault();
        const id = $('#service-id').val();
        const data = {
            name: $('#service-name').val(),
            description: $('#service-description').val(),
            base_cost: parseFloat($('#service-cost').val()),
            is_active: $('#service-active').is(':checked')
        };

        const url = id ? `/auth/mechanic/services/${id}/` : '/auth/mechanic/services/';
        const method = id ? 'PATCH' : 'POST';

        $.ajax({
            url: url,
            type: method,
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function() {
                // More robust modal hiding
                const modalEl = document.getElementById('serviceModal');
                const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                modal.hide();
                
                // Refresh list and reset form
                fetchServices();
                $('#service-form')[0].reset();
                $('#service-id').val('');
            },
            error: function(xhr) {
                console.error("Service Save Error:", xhr.responseText);
                const errorData = xhr.responseJSON;
                let errorMsg = 'Failed to save service';
                if (errorData) {
                    errorMsg = Object.keys(errorData).map(key => `${key}: ${errorData[key]}`).join('\n');
                }
                alert(errorMsg);
            }
        });
    });

    window.toggleService = function(id, status) {
        $.ajax({
            url: `/auth/mechanic/services/${id}/`,
            type: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify({ is_active: status }),
            success: function() {
                fetchServices();
            }
        });
    };



    window.openStatusModal = function(id) {
        $.ajax({
            url: `/auth/mechanic/jobs/${id}/`,
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(job) {
                let actionContent = '';
                if (job.status === 'PAID' || job.status === 'ACCEPTED') {
                    actionContent = `
                        <p class="text-dim">You have accepted this job. Ready to start the ride?</p>
                        <button class="btn-action w-100 py-3 mt-3 fw-bold fs-6" style="background: var(--accent);" onclick="updateJobStatus(${job.id}, 'ON_THE_WAY')">Start Ride to Customer</button>
                    `;
                } else if (job.status === 'ON_THE_WAY') {
                    actionContent = `
                        <div class="mb-4">
                            <label class="stat-label">Verification OTP</label>
                            <input type="text" id="otp-input" class="form-control-custom w-100 text-center fs-3 fw-bold" maxlength="4" placeholder="0000">
                            <div class="text-dim x-small mt-2 text-center">Enter the 4-digit code provided by the customer</div>
                        </div>
                        <button class="btn-action w-100 py-3 fw-bold fs-6" style="background: var(--accent);" onclick="updateJobStatus(${job.id}, 'IN_PROGRESS')">Verify & Start Work</button>
                    `;
                } else if (job.status === 'IN_PROGRESS') {
                    actionContent = `
                        <div class="alert alert-info bg-opacity-10 border-0 text-white small mb-4">
                            Ensure the vehicle is ready before completing the service.
                        </div>
                        <button class="btn-action w-100 py-3 fw-bold fs-6 bg-success border-0" onclick="updateJobStatus(${job.id}, 'COMPLETED')">Complete Service</button>
                    `;
                }

                $('#status-modal-content').html(`
                    <div class="row g-3 mb-4">
                        <div class="col-6">
                            <div class="stat-label">Customer</div>
                            <div class="fw-semibold">${job.customer.name}</div>
                        </div>
                        <div class="col-6">
                            <div class="stat-label">Estimated Payout</div>
                            <div class="fw-semibold text-success">₹${job.total_amount}</div>
                        </div>
                    </div>
                    <div class="mb-4">
                        <div class="stat-label">Service Address</div>
                        <div class="small mb-2">${job.location}</div>
                        <a href="https://www.google.com/maps?q=${job.location}" target="_blank" class="btn-action btn-sm w-100 text-center text-decoration-none d-block">Open in Google Maps</a>
                    </div>
                    <hr class="opacity-10 my-4">
                    <button class="chat-fab w-100 justify-content-center mb-3" onclick="ChatWidget.open(${job.id}, '${job.customer.name}', ${currentUserId})">💬 Chat with ${job.customer.name}</button>
                    ${actionContent}
                `);
                new bootstrap.Modal(document.getElementById('statusUpdateModal')).show();
            }
        });
    };

    window.updateJobStatus = function(id, newStatus) {
        const data = { status: newStatus };
        if (newStatus === 'IN_PROGRESS') {
            const otp = $('#otp-input').val();
            if (!otp) return alert('Please enter OTP');
            data.service_otp = otp;
        }

        $.ajax({
            url: `/auth/mechanic/jobs/${id}/status/`,
            type: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function() {
                const modal = bootstrap.Modal.getInstance(document.getElementById('statusUpdateModal'));
                if (modal) modal.hide();
                fetchJobs();
                fetchStats();
            },
            error: function(xhr) {
                alert(xhr.responseJSON?.error || 'Update failed');
            }
        });
    };

    function loadProfile() {
        $.ajax({
            url: '/auth/mechanic/onboarding/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(profile) {
                // Update Availability UI
                updateAvailabilityUI(profile.is_available);
                
                // Set checkbox in profile section
                $('#profile-availability-checkbox').prop('checked', profile.is_available);

                // Load other profile details
                $('#profile-details-area').html(`
                    <div class="mb-3">
                        <div class="stat-label">Business Address</div>
                        <div class="p-3 rounded" style="background: rgba(255,255,255,0.03);">${profile.address || 'Not provided'}</div>
                    </div>
                    <div class="row">
                        <div class="col-6">
                            <div class="stat-label">Latitude</div>
                            <div class="p-2 rounded" style="background: rgba(255,255,255,0.03);">${profile.latitude || 'N/A'}</div>
                        </div>
                        <div class="col-6">
                            <div class="stat-label">Longitude</div>
                            <div class="p-2 rounded" style="background: rgba(255,255,255,0.03);">${profile.longitude || 'N/A'}</div>
                        </div>
                    </div>
                `);
            }
        });
    }

    function updateAvailabilityUI(isAvailable) {
        const area = $('#availability-status-area');
        if (isAvailable) {
            area.html('<span class="availability-badge badge-online">● ONLINE</span>');
        } else {
            area.html('<span class="availability-badge badge-offline">○ OFFLINE</span>');
        }
    }

    // Availability Toggle from Profile
    $('#profile-availability-checkbox').on('change', function() {
        const isAvailable = $(this).is(':checked');
        $.ajax({
            url: '/auth/mechanic/availability/',
            type: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify({ is_available: isAvailable }),
            success: function(response) {
                updateAvailabilityUI(response.is_available);
            }
        });
    });

    // Logout
    $('#logout-btn').click(function(e) {
        e.preventDefault();
        localStorage.clear();
        window.location.href = '/login/';
    });

    // ── Video Lectures ──────────────────────────────────────────────

    function fetchLectures() {
        $.ajax({
            url: '/auth/mechanic/lectures/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(data) {
                const grid = $('#lectures-grid');
                grid.empty();
                const lectures = data.results || data;

                if (!lectures || lectures.length === 0) {
                    grid.hide();
                    $('#lectures-empty').show();
                    return;
                }

                $('#lectures-empty').hide();
                grid.show();

                lectures.forEach(l => {
                    const videoUrl = l.video_url || l.video_file;
                    const card = `
                        <div class="col-md-6 col-lg-4">
                            <div class="content-section p-0" style="overflow: hidden; border-radius: 20px;">
                                <div style="position: relative; background: #000; border-radius: 20px 20px 0 0; overflow: hidden;">
                                    <video
                                        controls
                                        preload="metadata"
                                        style="width: 100%; height: 220px; object-fit: cover; display: block;"
                                        poster=""
                                    >
                                        <source src="${videoUrl}" type="video/mp4">
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                                <div class="p-4">
                                    <div class="fw-bold mb-1" style="font-size: 16px;">${l.title}</div>
                                    <div class="text-dim small mb-3" style="min-height: 36px;">${l.description || 'No description provided'}</div>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div class="text-dim" style="font-size: 11px;">
                                            📅 ${new Date(l.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </div>
                                        <div class="text-dim" style="font-size: 11px;">
                                            👤 ${l.uploaded_by_name || 'Admin'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    grid.append(card);
                });
            },
            error: function() {
                $('#lectures-grid').hide();
                $('#lectures-empty').show();
            }
        });
    }

    // Load lectures when navigating to that section
    $(document).on('click', '#link-lectures', function() {
        fetchLectures();
    });
});