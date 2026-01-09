
// State
const state = {
    services: [
        { id: 1, name: "Limpieza Facial Profunda", duration: 15, price: 50, icon: "sparkles", description: "Tratamiento revitalizante para una piel radiante." },
        { id: 2, name: "Masaje Relajante", duration: 60, price: 40, icon: "sun", description: "Alivia el estrés y relaja tus músculos." },
        { id: 3, name: "Tratamiento Anti-Edad", duration: 30, price: 80, icon: "gem", description: "Tecnología avanzada para rejuvenecer tu piel." },
        { id: 4, name: "Manicura y Pedicura Spa", duration: 90, price: 55, icon: "heart", description: "Cuidado completo para manos y pies." }
    ],
    professionals: [
        { id: 1, name: "Dra. Ana López", specialty: "Faciales", serviceIds: [1, 3] },
        { id: 2, name: "Lic. Sofía Martínez", specialty: "Corporal", serviceIds: [2] },
        { id: 3, name: "Carla Estética", specialty: "Uñas", serviceIds: [4] }
    ],
    bookings: JSON.parse(localStorage.getItem('lumina_bookings')) || [],
    currentView: 'home'
};

// App Logic
const app = {
    init() {
        this.renderHome();
        this.updateIcons();
    },

    navigate(view) {
        state.currentView = view;
        const main = document.getElementById('main-content');

        switch (view) {
            case 'home':
                this.renderHome();
                break;
            case 'services':
                this.renderServices();
                break;
            case 'booking':
                this.renderBooking();
                break;
            case 'admin':
                this.renderAdmin();
                break;
            default:
                this.renderHome();
        }
        window.scrollTo(0, 0);
        this.updateIcons();
    },

    startBooking(serviceId = null) {
        this.selectedService = serviceId;
        this.navigate('booking');
    },

    updateIcons() {
        if (window.lucide) {
            lucide.createIcons();
        }
    },

    // Renders
    renderHome() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <section class="container hero">
                <div class="hero-content">
                    <h1 class="hero-title">Descubre tu mejor versión</h1>
                    <p class="hero-subtitle">Experiencias de bienestar y estética diseñadas exclusivamente para ti. Relájate, renueva y resplandece.</p>
                    <button onclick="app.navigate('services')" class="btn-primary">Ver Tratamientos</button>
                </div>
                <!-- Hero Image -->
                <img src="assets/hero_bg.png" alt="Spa Relax" class="hero-image">
            </section>

            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2 class="section-title">Nuestros Servicios Destacados</h2>
                        <p>Tratamientos personalizados para cada necesidad</p>
                    </div>
                    <div class="services-grid" id="featured-services">
                        <!-- Services injected here -->
                    </div>
                </div>
            </section>
        `;

        // Inject top 3 services
        const grid = document.getElementById('featured-services');
        state.services.slice(0, 3).forEach(service => {
            grid.innerHTML += this.createServiceCard(service);
        });
    },

    renderServices() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2 class="section-title">Menú de Tratamientos</h2>
                        <p>Selecciona el tratamiento ideal para ti</p>
                    </div>
                    <div class="services-grid">
                        ${state.services.map(s => this.createServiceCard(s)).join('')}
                    </div>
                </div>
            </section>
        `;
    },

    createServiceCard(service) {
        return `
            <div class="service-card" onclick="app.startBooking(${service.id})">
                <div class="service-icon">
                    <i data-lucide="${service.icon}"></i>
                </div>
                <h3>${service.name}</h3>
                <p style="color: #666; margin: 0.5rem 0;">${service.description}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem;">
                    <span style="font-weight: 600; color: var(--primary-dark);">$${service.price}</span>
                    <span style="color: #999; font-size: 0.9rem;">${service.duration} min</span>
                </div>
            </div>
        `;
    },

    renderBooking() {
        const main = document.getElementById('main-content');
        const defaultService = state.services.find(s => s.id === this.selectedService)?.id || "";

        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="booking-container">
                        <h2 class="text-center mb-4">Reserva tu Turno</h2>
                        <form id="booking-form" onsubmit="app.handleBookingSubmit(event)">
                            <div class="form-group">
                                <label class="form-label">Servicio</label>
                                <select class="form-select" name="service" id="service-select" required onchange="app.filterProfessionals()">
                                    <option value="">Selecciona un servicio</option>
                                    ${state.services.map(s =>
            `<option value="${s.id}" ${s.id === defaultService ? 'selected' : ''}>${s.name} - $${s.price}</option>`
        ).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Profesional</label>
                                <select class="form-select" name="professional" id="professional-select" required onchange="app.generateTimeSlots()" disabled>
                                    <option value="">Primero selecciona un servicio</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Fecha</label>
                                <input type="date" class="form-input" name="date" required min="${new Date().toISOString().split('T')[0]}" onchange="app.generateTimeSlots()">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Horario</label>
                                <div class="time-slots" id="time-slots">
                                    <!-- Time slots generate by JS -->
                                </div>
                                <input type="hidden" name="time" id="selected-time" required>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Nombre Completo</label>
                                <input type="text" class="form-input" name="name" required placeholder="Tu nombre">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-input" name="email" required placeholder="tu@email.com">
                            </div>

                            <button type="submit" class="btn-primary" style="width: 100%">Confirmar Reserva</button>
                        </form>
                    </div>
                </div>
            </section>
        `;

        this.filterProfessionals();
    },

    filterProfessionals() {
        const serviceId = document.getElementById('service-select').value;
        const profSelect = document.getElementById('professional-select');

        profSelect.innerHTML = '<option value="">Selecciona un profesional</option>';
        profSelect.disabled = !serviceId;

        if (!serviceId) return;

        const availableProfs = state.professionals.filter(p => p.serviceIds.includes(parseInt(serviceId)));

        profSelect.innerHTML += availableProfs.map(p =>
            `<option value="${p.id}">${p.name} (${p.specialty})</option>`
        ).join('');

        // Reset slots
        document.getElementById('time-slots').innerHTML = '';
    },

    generateTimeSlots() {
        const slotsContainer = document.getElementById('time-slots');

        const serviceSelect = document.getElementById('service-select');
        const profSelect = document.getElementById('professional-select');
        const dateInput = document.querySelector('input[name="date"]');

        const serviceId = serviceSelect ? serviceSelect.value : null;
        const profId = profSelect ? profSelect.value : null;
        const date = dateInput ? dateInput.value : null;

        if (!serviceId || !profId || !date) {
            slotsContainer.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: #666;">Completa Servicio, Profesional y Fecha para ver horarios.</p>';
            return;
        }

        const service = state.services.find(s => s.id == serviceId);
        const duration = service.duration;
        const times = [];
        const endTotalMinutes = 18 * 60;  // 18:00
        const lunchStart = 13 * 60;       // 13:00
        const lunchEnd = 14 * 60;         // 14:00

        for (let currentTime = startTotalMinutes; currentTime + duration <= endTotalMinutes; currentTime += duration) {
            // Check if slot overlaps with lunch break
            const slotEnd = currentTime + duration;
            // Overlap logic: Start < LunchEnd AND End > LunchStart
            const overlapsLunch = (currentTime < lunchEnd && slotEnd > lunchStart);

            if (!overlapsLunch) {
                // Convert minutes back to HH:MM format
                const hours = Math.floor(currentTime / 60);
                const minutes = currentTime % 60;
                const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                times.push(timeStr);
            }
        }

        slotsContainer.innerHTML = times.map(time => `
            <div class="time-slot" onclick="app.selectTime(this, '${time}')">${time}</div>
        `).join('');
    },

    selectTime(el, time) {
        document.querySelectorAll('.time-slot').forEach(d => d.classList.remove('selected'));
        el.classList.add('selected');
        document.getElementById('selected-time').value = time;
    },

    handleBookingSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const booking = {
            id: Date.now(),
            serviceId: formData.get('service'),
            serviceName: state.services.find(s => s.id == formData.get('service')).name,
            professionalId: formData.get('professional'),
            professionalName: state.professionals.find(p => p.id == formData.get('professional')).name,
            date: formData.get('date'),
            time: formData.get('time'),
            clientName: formData.get('name'),
            clientEmail: formData.get('email'),
            status: 'Confirmado'
        };

        state.bookings.push(booking);
        localStorage.setItem('lumina_bookings', JSON.stringify(state.bookings));

        alert('¡Turno reservado con éxito!');
        this.navigate('home');
    },

    renderAdmin() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2>Panel de Administración</h2>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Hora</th>
                                    <th>Profesional</th>
                                    <th>Cliente</th>
                                    <th>Servicio</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${state.bookings.length ? state.bookings.map(b => `
                                    <tr>
                                        <td>${b.date}</td>
                                        <td>${b.time}</td>
                                        <td><strong>${b.professionalName || '-'}</strong></td>
                                        <td>${b.clientName}</td>
                                        <td>${b.serviceName}</td>
                                        <td><span style="padding: 4px 8px; background: #e6fffa; color: #047857; border-radius: 4px;">${b.status}</span></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="5" class="text-center">No hay reservas aún.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        `;
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => app.init());
