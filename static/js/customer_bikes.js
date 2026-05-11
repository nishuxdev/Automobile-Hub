const BikeManager = {
    token: localStorage.getItem('access_token'),

    init: function() {
        this.bindEvents();
        this.fetchBikeDropdown(); // Also preload dropdown for booking flow
    },

    bindEvents: function() {
        const self = this;
        
        // Form Submission (Add/Edit)
        $('#bike-form').on('submit', function(e) {
            e.preventDefault();
            self.saveBike();
        });

        // Preview photo on change
        $('#bike-photo').on('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    $('#bike-photo-preview').attr('src', e.target.result).show();
                }
                reader.readAsDataURL(file);
            }
        });

        // Hook into the booking flow bike selection
        $('#book-bike-select').on('change', function() {
            const val = $(this).val();
            if (val === 'other') {
                $('#book-bike-model-group').slideDown();
                $('#book-bike-model').val('');
            } else {
                $('#book-bike-model-group').slideUp();
                // Optional: prefill manual input just in case backend populates it
                const selectedText = $("#book-bike-select option:selected").text();
                $('#book-bike-model').val(val ? selectedText : '');
            }
        });
    },

    fetchBikes: function() {
        const self = this;
        const container = $('#bikes-list-container');
        container.html('<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>');

        $.ajax({
            url: '/auth/customer/bikes/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + this.token },
            success: function(bikes) {
                const results = bikes.results || bikes;
                container.empty();
                
                if (!results || results.length === 0) {
                    container.html(`
                        <div class="empty-state-container">
                            <div class="empty-icon">🏍️</div>
                            <div class="empty-title">No bikes registered</div>
                            <div class="empty-desc">Register your motorcycles to track their service history.</div>
                            <button class="btn-primary-glow" onclick="BikeManager.openModal()">Register First Bike</button>
                        </div>
                    `);
                    return;
                }

                const grid = $('<div class="row g-4"></div>');
                results.forEach(bike => {
                    const photoUrl = bike.photo || '/static/images/bike-placeholder.png'; // Need placeholder check later
                    const lastService = bike.last_service_date ? new Date(bike.last_service_date).toLocaleDateString() : 'No services yet';
                    
                    grid.append(`
                        <div class="col-md-6 col-lg-4">
                            <div class="bike-card dashboard-card-glow h-100" style="background: rgba(30,30,38,0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; overflow: hidden; transition: all 0.3s ease;">
                                <div class="bike-card-img" style="height: 160px; width: 100%; position: relative; background: #111; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                    ${bike.photo ? `<img src="${bike.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="font-size: 60px; opacity: 0.3;">🏍️</div>`}
                                    <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 8px;">
                                        <button class="btn btn-sm btn-dark bg-opacity-50 p-1 rounded-circle" onclick="BikeManager.openModal(${bike.id})" style="width:32px; height:32px;"><i class="edit-icon">✏️</i></button>
                                    </div>
                                </div>
                                <div class="p-4">
                                    <div class="d-flex justify-content-between align-items-start mb-2">
                                        <div>
                                            <h5 class="mb-0 fw-bold" style="color: var(--accent);">${bike.brand} ${bike.model}</h5>
                                            <span class="text-dim small">${bike.nickname || 'My Bike'}</span>
                                        </div>
                                        ${bike.color ? `<span class="badge rounded-pill" style="background: ${self.getColorCode(bike.color)}; border: 1px solid rgba(255,255,255,0.2); width: 20px; height: 20px;" title="${bike.color}"></span>` : ''}
                                    </div>
                                    <div class="mb-3">
                                        <code class="text-light opacity-75 small bg-dark p-1 px-2 rounded">${bike.registration_no || 'No Reg #'}</code>
                                    </div>
                                    <div class="row g-2 mb-3">
                                        <div class="col-6">
                                            <div class="text-dim x-small" style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Total Services</div>
                                            <div class="fw-bold">${bike.total_services}</div>
                                        </div>
                                        <div class="col-6">
                                            <div class="text-dim x-small" style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Last Service</div>
                                            <div class="small">${lastService}</div>
                                        </div>
                                    </div>
                                    <div class="d-grid mt-3">
                                        <button class="btn-outline-dim btn-sm" onclick="BikeManager.viewReport(${bike.id})">📊 View Service Report</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `);
                });
                container.append(grid);
                // Refresh dropdown list as well
                self.fetchBikeDropdown();
            },
            error: function(err) {
                container.html('<div class="text-danger text-center py-4">Failed to load bikes. Please retry.</div>');
            }
        });
    },

    fetchBikeDropdown: function() {
        $.ajax({
            url: '/auth/customer/bikes/select/',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + this.token },
            success: function(bikes) {
                const select = $('#book-bike-select');
                const currentValue = select.val();
                
                // Keep first few options
                select.find('option').not(':first').remove();
                
                if (bikes && bikes.length > 0) {
                    bikes.forEach(b => {
                        select.append(`<option value="${b.id}">${b.display_name}</option>`);
                    });
                }
                select.append('<option value="other">+ Register/Type Another Model</option>');
                
                if (currentValue) select.val(currentValue);
            }
        });
    },

    openModal: function(id = null) {
        const modal = new bootstrap.Modal(document.getElementById('bikeModal'));
        $('#bike-form')[0].reset();
        $('#bike-id').val(id || '');
        $('#bike-photo-preview').hide().attr('src', '');
        $('#bike-modal-title').text(id ? 'Edit Bike' : 'Register New Bike');
        
        $('#delete-bike-btn').toggle(!!id);

        if (id) {
            $.ajax({
                url: `/auth/customer/bikes/${id}/`,
                type: 'GET',
                headers: { 'Authorization': 'Bearer ' + this.token },
                success: function(bike) {
                    $('#bike-brand').val(bike.brand);
                    $('#bike-model-name').val(bike.model);
                    $('#bike-nickname').val(bike.nickname);
                    $('#bike-reg-no').val(bike.registration_no);
                    $('#bike-year').val(bike.year);
                    $('#bike-color').val(bike.color);
                    $('#bike-cc').val(bike.engine_cc);
                    $('#bike-fuel').val(bike.fuel_type);
                    $('#bike-notes').val(bike.notes);
                    
                    if (bike.photo) {
                        $('#bike-photo-preview').attr('src', bike.photo).show();
                    }
                    modal.show();
                }
            });
        } else {
            modal.show();
        }
    },

    saveBike: function() {
        const id = $('#bike-id').val();
        const method = id ? 'PATCH' : 'POST';
        const url = id ? `/auth/customer/bikes/${id}/` : '/auth/customer/bikes/';
        
        const formElement = document.getElementById('bike-form');
        const formData = new FormData(formElement);
        
        // Remove empty photo if patching, and don't send if empty on create if you like
        const photoInput = document.getElementById('bike-photo');
        if (!photoInput.files[0]) {
            formData.delete('photo');
        }
        
        const btn = $('#save-bike-btn');
        btn.prop('disabled', true).text('Saving...');

        $.ajax({
            url: url,
            type: method,
            headers: { 'Authorization': 'Bearer ' + this.token },
            data: formData,
            processData: false,
            contentType: false,
            success: function(res) {
                bootstrap.Modal.getInstance(document.getElementById('bikeModal')).hide();
                BikeManager.fetchBikes();
                alert('Bike saved successfully!');
            },
            error: function(err) {
                alert('Error saving bike: ' + JSON.stringify(err.responseJSON));
            },
            complete: function() {
                btn.prop('disabled', false).text('Save Bike');
            }
        });
    },

    deleteBike: function() {
        const id = $('#bike-id').val();
        if (!id || !confirm('Are you sure you want to remove this bike? (Historical bookings will still be preserved)')) return;

        $.ajax({
            url: `/auth/customer/bikes/${id}/`,
            type: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + this.token },
            success: function() {
                bootstrap.Modal.getInstance(document.getElementById('bikeModal')).hide();
                BikeManager.fetchBikes();
            },
            error: function() {
                alert('Failed to delete.');
            }
        });
    },

    viewReport: function(id) {
        const modal = new bootstrap.Modal(document.getElementById('bikeReportModal'));
        const container = $('#bike-report-content');
        container.html('<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>');
        modal.show();

        $.ajax({
            url: `/auth/customer/bikes/${id}/report/`,
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + this.token },
            success: function(report) {
                const stats = report.stats;
                
                let html = `
                    <div class="d-flex align-items-center gap-4 mb-4 p-3 rounded" style="background: rgba(255,255,255,0.03);">
                        <div style="width: 80px; height: 80px; border-radius: 12px; background: #222; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                            ${report.photo ? `<img src="${report.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="font-size: 40px;">🏍️</span>`}
                        </div>
                        <div>
                            <h4 class="mb-1 text-accent fw-bold">${report.brand} ${report.model}</h4>
                            <div class="text-white opacity-75">${report.registration_no || 'No Registration #'}</div>
                            <div class="small text-dim mt-1">${report.year ? 'Year: '+report.year : ''} ${report.engine_cc ? ' • '+report.engine_cc+' cc' : ''} • ${report.fuel_type}</div>
                        </div>
                    </div>

                    <div class="row g-3 mb-4">
                        <div class="col-3"><div class="text-center p-3 rounded" style="background: rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.2);"><div class="fs-4 fw-bold text-accent">${stats.total_services}</div><div class="x-small text-dim" style="font-size:10px;">SERVICES</div></div></div>
                        <div class="col-3"><div class="text-center p-3 rounded" style="background: rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2);"><div class="fs-4 fw-bold text-success">₹${Math.round(stats.total_spent)}</div><div class="x-small text-dim" style="font-size:10px;">TOTAL SPENT</div></div></div>
                        <div class="col-3"><div class="text-center p-3 rounded" style="background: rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05);"><div class="fs-5 fw-bold mt-1">${stats.last_service_date ? new Date(stats.last_service_date).toLocaleDateString() : '--'}</div><div class="x-small text-dim" style="font-size:10px;">LAST SERVICE</div></div></div>
                        <div class="col-3"><div class="text-center p-3 rounded" style="background: rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05);"><div class="fs-4 fw-bold text-warning">${stats.avg_rating_given || 'N/A'} ⭐</div><div class="x-small text-dim" style="font-size:10px;">AVG RATING</div></div></div>
                    </div>

                    <h5 class="mb-3 border-bottom pb-2 border-secondary border-opacity-25">Service History Timeline</h5>
                `;

                if (!report.service_history || report.service_history.length === 0) {
                    html += `<div class="text-center text-dim py-4">No service records found for this bike.</div>`;
                } else {
                    html += `<div class="service-timeline position-relative ps-4 mt-3" style="border-left: 2px dashed rgba(255,255,255,0.1);">`;
                    
                    report.service_history.forEach(h => {
                        const dateStr = new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                        const photoHtml = (h.before_photo || h.after_photo) ? `
                            <div class="d-flex gap-2 mt-2">
                                ${h.before_photo ? `<div class="position-relative"><img src="${h.before_photo}" style="width:60px; height:60px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open('${h.before_photo}')"><span style="position:absolute; bottom:0; left:0; background:rgba(0,0,0,0.7); font-size:8px; padding:2px 4px;">BEFORE</span></div>` : ''}
                                ${h.after_photo ? `<div class="position-relative"><img src="${h.after_photo}" style="width:60px; height:60px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open('${h.after_photo}')"><span style="position:absolute; bottom:0; left:0; background:rgba(0,0,0,0.7); font-size:8px; padding:2px 4px;">AFTER</span></div>` : ''}
                            </div>
                        ` : '';

                        html += `
                            <div class="timeline-item mb-4 position-relative">
                                <div style="position: absolute; left: -32px; top: 0; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); border: 3px solid #1a1a24;"></div>
                                <div class="p-3 rounded" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                                    <div class="d-flex justify-content-between align-items-start mb-2">
                                        <div>
                                            <span class="badge text-bg-secondary bg-opacity-25 small mb-1">${dateStr}</span>
                                            <h6 class="mb-0 fw-bold">${h.service_details}</h6>
                                        </div>
                                        <div class="text-end">
                                            <div class="fw-bold text-success">₹${h.total_amount}</div>
                                            <span class="badge rounded-pill ${h.status === 'COMPLETED' ? 'text-bg-success' : 'text-bg-warning'} bg-opacity-75" style="font-size:10px;">${h.status}</span>
                                        </div>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-secondary border-opacity-25">
                                        <div class="small text-dim">Mechanic: <span class="text-white opacity-75">${h.mechanic_name || 'Unknown'}</span></div>
                                        ${h.rating ? `<div class="small text-warning">Rated: ${h.rating.score} ⭐</div>` : ''}
                                    </div>
                                    ${photoHtml}
                                </div>
                            </div>
                        `;
                    });
                    html += `</div>`;
                }

                container.html(html);
            },
            error: function() {
                container.html('<div class="text-danger text-center py-4">Failed to fetch report.</div>');
            }
        });
    },

    getColorCode: function(name) {
        // Simple mapping helper for bootstrap colors or just pass directly
        const colors = {
            'red': '#ef4444', 'blue': '#3b82f6', 'black': '#000000', 
            'white': '#ffffff', 'silver': '#cbd5e1', 'grey': '#6b7280',
            'yellow': '#eab308', 'green': '#22c55e'
        };
        return colors[name.toLowerCase()] || name;
    }
};

// Expose global methods for inline HTML onclicks
window.BikeManager = BikeManager;

// Initialize when page is fully ready
$(document).ready(function() {
    BikeManager.init();
});
