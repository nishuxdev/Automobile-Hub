$(document).ready(function() {
    // Current page state
    let currentPageUsers = 1;
    let currentPageMechanics = 1;

    // Initial loads
    fetchStats();
    fetchUsers(null, '#summary-user-table-body', 1); // Dashboard summary

    // Navigation logic
    $('.nav-link').click(function(e) {
        e.preventDefault();
        const linkId = $(this).attr('id');
        const sectionId = linkId.replace('link-', 'section-');
        
        switchSection(sectionId);
        
        // Load data specific to section
        if (sectionId === 'section-dashboard') {
            fetchStats();
            fetchUsers(null, '#summary-user-table-body', 1);
        } else if (sectionId === 'section-users') {
            fetchUsers(null, '#full-user-table-body', currentPageUsers);
        } else if (sectionId === 'section-mechanics') {
            fetchUsers('mechanic', '#mechanic-table-body', currentPageMechanics);
        } else if (sectionId === 'section-verifications') {
            fetchVerifications();
        } else if (sectionId === 'section-bookings') {
            fetchBookings();
        } else if (sectionId === 'section-disputes') {
            fetchDisputes();
        } else if (sectionId === 'section-payments') {
            fetchPayments();
        } else if (sectionId === 'section-settings') {
            fetchConfig();
        } else if (sectionId === 'section-lectures') {
            fetchLectures();
        }
    });

    function switchSection(sectionId) {
        $('.nav-link').removeClass('active');
        $(`#link-${sectionId.replace('section-', '')}`).addClass('active');
        $('.dashboard-section').hide();
        $(`#${sectionId}`).fadeIn(300);
    }

    // Stats fetching
    function fetchStats() {
        $.ajax({
            url: '/auth/admin/stats/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function(data) {
                $('#total-users').text(data.total_users);
                $('#total-customers').text(data.customers);
                $('#total-mechanics').text(data.mechanics);
                $('#pending-active').text(data.pending_active);
            }
        });
    }

    // User list fetching
    function fetchUsers(role, tableBodyId, page = 1) {
        let url = `/auth/admin/users/?page=${page}`;
        if (role) {
            url += `&role=${role}`;
        }

        $.ajax({
            url: url,
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function(data) {
                const tbody = $(tableBodyId);
                tbody.empty();
                
                // DRF Paginated response has results key
                const userList = data.results || data;
                
                // Dashboard summary: only show first 5
                const displayData = tableBodyId === '#summary-user-table-body' ? userList.slice(0, 5) : userList;

                if (!displayData || displayData.length === 0) {
                    tbody.append('<tr><td colspan="4" class="text-center py-4 text-dim">No users found</td></tr>');
                    return;
                }

                displayData.forEach(user => {
                    const row = `
                        <tr>
                            <td>
                                <div class="d-flex align-items-center">
                                    <div class="status-indicator ${user.is_active ? 'status-active' : 'status-inactive'}"></div>
                                    <div>
                                        <div class="fw-semibold">${user.name}</div>
                                        <div class="text-dim small">${user.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="role-badge badge-${user.role}">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                            </td>
                            <td>${new Date(user.created_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn-action toggle-active" data-id="${user.id}" data-table="${tableBodyId}" data-role="${role}" data-page="${page}">
                                    ${user.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });

                // Update pagination controls if NOT the dashboard summary
                if (tableBodyId !== '#summary-user-table-body') {
                    const section = tableBodyId === '#full-user-table-body' ? 'users' : 'mechanics';
                    updatePaginationUI(section, data, page);
                }
            }
        });
    }

    function updatePaginationUI(section, data, page) {
        const infoText = $(`#${section}-pagination-info`);
        infoText.text(`Showing page ${page}`);

        const prevBtn = $(`.prev-page[data-section="${section}"]`);
        const nextBtn = $(`.next-page[data-section="${section}"]`);

        // Enable/Disable buttons based on DRF response
        prevBtn.prop('disabled', !data.previous);
        nextBtn.prop('disabled', !data.next);
    }

    // Pagination events
    $(document).on('click', '.next-page', function() {
        const section = $(this).data('section');
        if (section === 'users') {
            currentPageUsers++;
            fetchUsers(null, '#full-user-table-body', currentPageUsers);
        } else {
            currentPageMechanics++;
            fetchUsers('mechanic', '#mechanic-table-body', currentPageMechanics);
        }
    });

    $(document).on('click', '.prev-page', function() {
        const section = $(this).data('section');
        if (section === 'users') {
            if (currentPageUsers > 1) {
                currentPageUsers--;
                fetchUsers(null, '#full-user-table-body', currentPageUsers);
            }
        } else {
            if (currentPageMechanics > 1) {
                currentPageMechanics--;
                fetchUsers('mechanic', '#mechanic-table-body', currentPageMechanics);
            }
        }
    });

    // Toggle user status
    $(document).on('click', '.toggle-active', function() {
        const userId = $(this).data('id');
        const tableBodyId = $(this).data('table');
        const role = $(this).data('role');
        const page = $(this).data('page');
        const btn = $(this);
        btn.prop('disabled', true).text('...');

        $.ajax({
            url: `/auth/admin/users/${userId}/toggle-active/`,
            type: 'POST',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function() {
                fetchStats();
                fetchUsers(role, tableBodyId, page);
            }
        });
    });

    // API Fetchers for new modules
    function fetchVerifications() {
        $.ajax({
            url: '/auth/admin/mechanics/verifications/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function(data) {
                const tbody = $('#verifications-table-body');
                tbody.empty();
                const verifications = data.results || data;

                if (!verifications || verifications.length === 0) {
                    tbody.append('<tr><td colspan="4" class="text-center py-4 text-dim">No pending applications</td></tr>');
                    return;
                }

                verifications.forEach(v => {
                    const statusClass = v.verification_status === 'VERIFIED' ? 'text-success' : (v.verification_status === 'REJECTED' ? 'text-danger' : 'text-warning');
                    const addressText = v.address || 'No address provided';
                    const coords = (v.latitude && v.longitude) ? `${v.latitude}, ${v.longitude}` : 'No coordinates';
                    const lat = v.latitude;
                    const lon = v.longitude;
                    const mapLink = (lat && lon) ? `<a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" class="text-accent small text-decoration-none">🗺️ View on Map</a>` : '';
                    
                    const row = `
                        <tr>
                            <td>
                                <div class="fw-semibold">${v.user ? v.user.name : 'Unknown'}</div>
                                <div class="text-dim small">${v.user ? v.user.email : ''}</div>
                                <div class="badge badge-sm ${statusClass} p-0" style="font-size: 10px; background: none; border:none;">${v.verification_status}</div>
                            </td>
                            <td>
                                <div class="small fw-semibold text-wrap" style="max-width: 250px;">${addressText}</div>
                                <div class="text-dim x-small mb-1" style="font-size: 11px;">📍 ${coords}</div>
                                ${mapLink}
                            </td>
                            <td>
                                <div class="d-flex flex-column gap-1">
                                    ${v.license_doc ? `<a href="${v.license_doc}" target="_blank" class="text-info small text-decoration-none">🪪 License Doc</a>` : '<span class="text-dim small">No License</span>'}
                                    ${v.id_doc ? `<a href="${v.id_doc}" target="_blank" class="text-info small text-decoration-none">🆔 Identity Doc</a>` : '<span class="text-dim small">No ID</span>'}
                                </div>
                            </td>
                            <td>
                                <div class="d-flex gap-2">
                                    ${v.verification_status === 'PENDING' ? `
                                        <button class="btn-action verify-action btn-sm py-1 px-2" data-id="${v.id}" data-action="APPROVE">Approve</button>
                                        <button class="btn-action verify-action btn-sm py-1 px-2 text-danger" data-id="${v.id}" data-action="REJECT">Reject</button>
                                    ` : '<span class="text-dim small">No action needed</span>'}
                                </div>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });
            }
        });
    }

    function fetchBookings() {
        $.ajax({
            url: '/auth/admin/bookings/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function(data) {
                const tbody = $('#bookings-table-body');
                tbody.empty();
                const bookings = data.results || data;

                if (!bookings || bookings.length === 0) {
                    tbody.append('<tr><td colspan="5" class="text-center py-4 text-dim">No bookings found</td></tr>');
                    return;
                }

                bookings.forEach(b => {
                    const row = `
                        <tr>
                            <td class="fw-bold text-accent">#${b.id}</td>
                            <td>
                                <div><span class="text-dim">C:</span> ${b.customer ? b.customer.name : 'N/A'}</div>
                                <div><span class="text-dim">M:</span> ${b.mechanic ? b.mechanic.name : 'Unassigned'}</div>
                            </td>
                            <td><span class="role-badge" style="background:rgba(255,255,255,0.1)">${b.status}</span></td>
                            <td>${new Date(b.created_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn-action booking-override" data-id="${b.id}" data-status="CANCELLED" title="Force Cancel">🛑 Cancel</button>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });
            }
        });
    }

    function fetchDisputes() {
        $.ajax({
            url: '/auth/admin/disputes/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function(data) {
                const tbody = $('#disputes-table-body');
                tbody.empty();
                const disputes = data.results || data;

                if (!disputes || disputes.length === 0) {
                    tbody.append('<tr><td colspan="5" class="text-center py-4 text-dim">No disputes found</td></tr>');
                    return;
                }

                disputes.forEach(d => {
                    const row = `
                        <tr>
                            <td>#${d.id}</td>
                            <td><a href="#" class="text-info text-decoration-none">Booking #${d.booking ? d.booking.id : 'N/A'}</a></td>
                            <td class="fw-bold text-warning">${d.status}</td>
                            <td><div class="text-truncate" style="max-width: 200px;" title="${d.customer_complaint}">${d.customer_complaint}</div></td>
                            <td>
                                <button class="btn-action dispute-action" data-id="${d.id}" data-action="RESOLVE">Resolve</button>
                                <button class="btn-action dispute-action border-warning text-warning" data-id="${d.id}" data-action="REFUND">Refund</button>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });
            }
        });
    }

    function fetchPayments() {
        $.ajax({
            url: '/auth/admin/payments/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function(data) {
                const tbody = $('#payments-table-body');
                tbody.empty();
                const payments = data.results || data;

                if (!payments || payments.length === 0) {
                    tbody.append('<tr><td colspan="4" class="text-center py-4 text-dim">No payments found</td></tr>');
                    return;
                }

                payments.forEach(p => {
                    const row = `
                        <tr>
                            <td class="text-dim">${p.transaction_id || 'N/A'}</td>
                            <td>Booking #${p.booking_id}</td>
                            <td class="fw-bold">$${p.amount}</td>
                            <td class="${p.status === 'SUCCESS' ? 'text-success' : 'text-danger'}">${p.status}</td>
                        </tr>
                    `;
                    tbody.append(row);
                });
            }
        });
    }

    function fetchConfig() {
        $.ajax({
            url: '/auth/admin/config/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function(data) {
                // Populate the settings form
                $('#config-fee-type').val(data.fee_type);
                $('#config-fee-value').val(data.fee_value);
            }
        });
    }

    // Action Handlers
    $(document).on('click', '.verify-action', function() {
        const id = $(this).data('id');
        const action = $(this).data('action');
        let notes = '';
        if (action === 'REJECT') {
            notes = prompt('Enter rejection reason (Internal Note):');
            if (notes === null) return;
        }

        $.ajax({
            url: `/auth/admin/mechanics/${id}/verify/`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ action: action, notes: notes }),
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function() { fetchVerifications(); }
        });
    });

    $(document).on('click', '.booking-override', function() {
        if (!confirm('Are you sure you want to force override this booking?')) return;
        const id = $(this).data('id');
        const status = $(this).data('status');
        
        $.ajax({
            url: `/auth/admin/bookings/${id}/override/`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ status: status }),
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function() { fetchBookings(); }
        });
    });

    $(document).on('click', '.dispute-action', function() {
        const id = $(this).data('id');
        const action = $(this).data('action');
        const confirmMsg = action === 'REFUND' ? 'Issue a refund and close dispute?' : 'Mark dispute as resolved?';
        if (!confirm(confirmMsg)) return;

        $.ajax({
            url: `/auth/admin/disputes/${id}/action/`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ action: action, notes: `Action taken by admin: ${action}` }),
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function() { fetchDisputes(); fetchPayments(); }
        });
    });

    // Logout
    $('#logout-btn').click(function(e) {
        e.preventDefault();
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login/';
    });

    // ── Video Lectures ──────────────────────────────────────────────

    function fetchLectures() {
        $.ajax({
            url: '/auth/admin/lectures/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function(data) {
                const tbody = $('#lectures-table-body');
                tbody.empty();
                const lectures = data.results || data;

                if (!lectures || lectures.length === 0) {
                    tbody.append('<tr><td colspan="5" class="text-center py-4 text-dim">No lectures uploaded yet</td></tr>');
                    return;
                }

                lectures.forEach(l => {
                    const statusBadge = l.is_active
                        ? '<span class="role-badge" style="background: rgba(34,197,94,0.15); color: #22c55e;">Active</span>'
                        : '<span class="role-badge" style="background: rgba(148,163,184,0.15); color: #94a3b8;">Inactive</span>';
                    const row = `
                        <tr>
                            <td>
                                <div class="d-flex align-items-center gap-3">
                                    <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, var(--accent), #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">🎬</div>
                                    <div>
                                        <div class="fw-semibold">${l.title}</div>
                                        <div class="text-dim small text-truncate" style="max-width: 250px;">${l.description || 'No description'}</div>
                                    </div>
                                </div>
                            </td>
                            <td>${l.uploaded_by_name || 'Admin'}</td>
                            <td>${new Date(l.created_at).toLocaleDateString()}</td>
                            <td>${statusBadge}</td>
                            <td>
                                <div class="d-flex gap-2">
                                    <a href="${l.video_url || l.video_file}" target="_blank" class="btn-action btn-sm text-info text-decoration-none">▶ Play</a>
                                    <button class="btn-action btn-sm text-danger delete-lecture" data-id="${l.id}">🗑 Delete</button>
                                </div>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });
            }
        });
    }

    // Drag-and-drop zone
    const dropZone = document.getElementById('video-drop-zone');
    const fileInput = document.getElementById('lecture-video');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--accent)';
            dropZone.style.background = 'rgba(99,102,241,0.1)';
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = 'rgba(99,102,241,0.4)';
            dropZone.style.background = 'rgba(99,102,241,0.04)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'rgba(99,102,241,0.4)';
            dropZone.style.background = 'rgba(99,102,241,0.04)';
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                updateDropZoneText(fileInput.files[0].name);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
                updateDropZoneText(fileInput.files[0].name);
            }
        });
    }

    function updateDropZoneText(name) {
        $('#drop-zone-text').html(`<span class="text-success">✓</span> ${name}`);
    }

    // Upload lecture
    $('#lecture-upload-form').on('submit', function(e) {
        e.preventDefault();
        const title = $('#lecture-title').val().trim();
        const description = $('#lecture-description').val().trim();
        const videoFile = $('#lecture-video')[0].files[0];

        if (!title || !videoFile) {
            alert('Please provide a title and select a video file.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('video_file', videoFile);

        $('#upload-btn').prop('disabled', true);
        $('#upload-progress').show();

        $.ajax({
            url: '/auth/admin/lectures/',
            type: 'POST',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            data: formData,
            processData: false,
            contentType: false,
            xhr: function() {
                const xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener('progress', function(evt) {
                    if (evt.lengthComputable) {
                        const pct = Math.round((evt.loaded / evt.total) * 100);
                        $('#upload-progress-text').text(`Uploading... ${pct}%`);
                    }
                }, false);
                return xhr;
            },
            success: function() {
                $('#lecture-upload-form')[0].reset();
                $('#drop-zone-text').text('Drag & drop video here or click to browse');
                $('#upload-btn').prop('disabled', false);
                $('#upload-progress').hide();
                fetchLectures();
            },
            error: function(xhr) {
                alert('Upload failed: ' + (xhr.responseJSON ? JSON.stringify(xhr.responseJSON) : 'Server error'));
                $('#upload-btn').prop('disabled', false);
                $('#upload-progress').hide();
            }
        });
    });

    // Delete lecture
    $(document).on('click', '.delete-lecture', function() {
        if (!confirm('Are you sure you want to delete this lecture?')) return;
        const id = $(this).data('id');
        const btn = $(this);
        btn.prop('disabled', true).text('...');

        $.ajax({
            url: `/auth/admin/lectures/${id}/`,
            type: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
            success: function() {
                fetchLectures();
            },
            error: function() {
                alert('Failed to delete lecture.');
                btn.prop('disabled', false).html('🗑 Delete');
            }
        });
    });
});