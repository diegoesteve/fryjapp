
// State
const state = {
    services: [
        {
            id: 1,
            name: "Limpieza Facial Profunda",
            category: "Facial",
            duration: 15,
            price: 50,
            priceRange: "$40 - $60",
            icon: "sparkles",
            description: "Tratamiento revitalizante para una piel radiante.",
            intro: "Ideal para purificar tu piel y devolverle su luminosidad natural.",
            benefits: ["Elimina impurezas profundas", "Piel más suave y luminosa", "Reduce poros dilatados", "Estimula la renovación celular"]
        },
        {
            id: 2,
            name: "Masaje Relajante",
            category: "Corporal",
            duration: 60,
            price: 40,
            priceRange: "$35 - $55",
            icon: "sun",
            description: "Alivia el estrés y relaja tus músculos.",
            intro: "Desconecta del mundo y regálate un momento de paz absoluta.",
            benefits: ["Reduce el estrés y la ansiedad", "Alivia dolores musculares", "Mejora la circulación", "Mejora la calidad del sueño"]
        },
        {
            id: 3,
            name: "Tratamiento Anti-Edad",
            category: "Facial",
            duration: 30,
            price: 80,
            priceRange: "$70 - $100",
            icon: "gem",
            description: "Tecnología avanzada para rejuvenecer tu piel.",
            intro: "Combate los signos del envejecimiento con nuestra tecnología de punta.",
            benefits: ["Reduce líneas de expresión", "Mejora la firmeza de la piel", "Hidratación profunda", "Efecto lifting inmediato"]
        },
        {
            id: 4,
            name: "Manicura y Pedicura Spa",
            category: "Manos y Pies",
            duration: 90,
            price: 55,
            priceRange: "$45 - $65",
            icon: "heart",
            description: "Cuidado completo para manos y pies.",
            intro: "Mima tus manos y pies con nuestro tratamiento spa integral.",
            benefits: ["Uñas perfectamente cuidadas", "Exfoliación e hidratación profunda", "Masaje relajante en manos y pies", "Esmaltado de larga duración"]
        }
    ],
    professionals: [
        { id: 1, name: "Dra. Morcilla", specialty: "Faciales", serviceIds: [1, 3], image: "assets/morci.jpeg" },
        { id: 2, name: "Lic. Delfi", specialty: "Corporal", serviceIds: [2], image: "assets/delfi.jpeg" },
        { id: 3, name: "Caro", specialty: "Uñas", serviceIds: [4], image: "assets/caro.jpeg" }
    ],
    bookings: (JSON.parse(localStorage.getItem('lumina_bookings')) || [
        {
            id: 1741549200000,
            serviceId: "1",
            serviceName: "Limpieza Facial Profunda",
            professionalId: "1",
            professionalName: "Dra. Morcilla",
            date: "2026-04-10",
            time: "09:00",
            clientName: "María Ejemplo",
            clientEmail: "maria@example.com",
            status: "Confirmado"
        },
        {
            id: 1741552800000,
            serviceId: "2",
            serviceName: "Masaje Relajante",
            professionalId: "2",
            professionalName: "Lic. Delfi",
            date: "2026-04-11",
            time: "14:00",
            clientName: "Juan Pérez",
            clientEmail: "juan@example.com",
            status: "Confirmado"
        }
    ]).sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.time);
        const dateB = new Date(b.date + 'T' + b.time);
        return dateA - dateB;
    }),
    currentView: 'home',
    currentUser: JSON.parse(localStorage.getItem('lumina_user')) || null,
    users: [
        { email: "admin@julielle.com", password: "admin", role: "admin", name: "Administrador" },
        { email: "profesional@julielle.com", password: "prof", role: "professional", name: "Dra. Morcilla", id: 1 },
        { email: "sofia@julielle.com", password: "prof", role: "professional", name: "Lic. Delfi", id: 2 },
        { email: "carla@julielle.com", password: "prof", role: "professional", name: "Caro", id: 3 },
        { email: "paciente@test.com", password: "123", role: "patient", name: "Paciente Test" }
    ],
    rescheduleId: null,
    patients: JSON.parse(localStorage.getItem('lumina_patients')) || [],
    visits: JSON.parse(localStorage.getItem('lumina_visits')) || [],
    adminFilters: { professionalId: '', status: '', month: '' }
};

// App Logic
const app = {
    init() {
        this.syncPatients();
        this.renderHome();
        this.updateIcons();
        this.updateNav(); // Initial nav update
        // Insert Modal HTML on init
        if (!document.getElementById('modal-overlay')) {
            document.body.insertAdjacentHTML('beforeend', `
                <div id="modal-overlay" class="modal-overlay">
                    <div id="modal-content" class="modal-content"></div>
                </div>
                <div id="toast" class="toast"></div>
                <!-- ENH-13 WhatsApp Float -->
                <a href="https://wa.me/1234567890" class="whatsapp-float" target="_blank" title="Consultar por WhatsApp">
                    <i data-lucide="message-circle" width="32" height="32"></i>
                </a>
            `);
        }
    },

    navigate(view, params = null) {
        // Auth Guards
        if (view === 'admin' && (!state.currentUser || state.currentUser.role !== 'admin')) {
            return this.navigate('login');
        }
        if (view === 'my-bookings' && !state.currentUser) {
            return this.navigate('login');
        }
        if (view === 'booking' && !state.currentUser) {
            this.selectedService = this.selectedService || params; // Preserve service selection
            return this.navigate('login');
        }

        state.currentView = view;

        switch (view) {
            case 'home':
                this.renderHome();
                break;
            case 'services':
                this.renderServices();
                break;
            case 'service-detail':
                this.renderServiceDetail(params);
                break;
            case 'professionals':
                this.renderProfessionals();
                break;
            case 'professional-profile':
                this.renderProfessionalProfile(params);
                break;
            case 'booking':
                this.renderBooking();
                break;
            case 'admin':
                this.renderAdmin();
                break;
            case 'reports':
                this.renderReports();
                break;
            case 'login':
                this.renderLogin();
                break;
            case 'register':
                this.renderRegister();
                break;
            case 'my-bookings':
                this.renderMyBookings();
                break;
            case 'patients':
                this.renderPatients();
                break;
            case 'patient-profile':
                this.renderPatientProfile(params);
                break;
            default:
                this.renderHome();
        }
        window.scrollTo(0, 0);
        this.updateIcons();
        this.updateNav();
    },

    login(email, password) {
        const user = state.users.find(u => u.email === email && u.password === password);
        if (user) {
            state.currentUser = { ...user }; // Copy user data
            delete state.currentUser.password; // Don't store password in session
            localStorage.setItem('lumina_user', JSON.stringify(state.currentUser));
            this.showNotification(`Bienvenido, ${user.name}`);

            if (user.role === 'admin') this.navigate('admin');
            else {
                const pendingService = localStorage.getItem('lumina_pending_service');
                if (pendingService) {
                    localStorage.removeItem('lumina_pending_service');
                    this.navigate('booking', pendingService); // Note: booking view doesn't take params directly but startBooking does. 
                    // Better approach:
                    this.selectedService = pendingService;
                    this.navigate('booking');
                } else if (this.selectedService) {
                    this.navigate('booking');
                } else {
                    this.navigate('home');
                }
            }
        } else {
            alert('Credenciales incorrectas');
        }
    },

    logout() {
        state.currentUser = null;
        localStorage.removeItem('lumina_user');
        this.showNotification('Has cerrado sesión');
        this.navigate('home');
    },

    forgotPassword() {
        const email = prompt('Por favor ingresa tu email para recuperar tu contraseña:');
        if (email) {
            // ENH-16: Simulate email sending
            this.showNotification(`Se ha enviado un correo de recuperación a ${email}`);
        }
    },

    syncPatients() {
        const bookings = state.bookings;
        const patientMap = new Map();

        // Load existing to preserve manual edits (phone, notes)
        state.patients.forEach(p => patientMap.set(p.email, p));

        bookings.forEach(b => {
            if (!patientMap.has(b.clientEmail)) {
                patientMap.set(b.clientEmail, {
                    email: b.clientEmail,
                    name: b.clientName,
                    phone: "Sin registrar",
                    firstVisit: b.date,
                    lastVisit: b.date,
                    totalVisits: 1
                });
            } else {
                const p = patientMap.get(b.clientEmail);
                if (b.date > p.lastVisit) p.lastVisit = b.date;
                if (b.date < p.firstVisit) p.firstVisit = b.date;
                // Recalculate total visits is tricky if we don't reset. 
                // Simple approach: Recalculate count from scratch?
            }
        });

        // Re-count visits for accuracy
        patientMap.forEach(p => {
            p.totalVisits = bookings.filter(b => b.clientEmail === p.email && b.status !== 'Cancelado').length;
        });

        state.patients = Array.from(patientMap.values());
        localStorage.setItem('lumina_patients', JSON.stringify(state.patients));
    },

    updateNav() {
        const nav = document.querySelector('.nav-links');
        const user = state.currentUser;

        let navHtml = `
            <button onclick="app.navigate('home')" class="nav-btn">Inicio</button>
            <button onclick="app.navigate('services')" class="nav-btn">Servicios</button>
            <button onclick="app.navigate('professionals')" class="nav-btn">Profesionales</button>
        `;

        if (user) {
            if (user.role === 'admin') {
                navHtml += `<button onclick="app.navigate('admin')" class="nav-btn secondary">Admin</button>`;
            } else {
                navHtml += `<button onclick="app.navigate('my-bookings')" class="nav-btn">Mis Turnos</button>`;
            }
            // ENH-26/27: Patient Management Button (Admin & Prof)
            if (user.role === 'admin' || user.role === 'professional') {
                navHtml += `<button onclick="app.navigate('patients')" class="nav-btn">Pacientes</button>`;
            }

            navHtml += `<button onclick="app.logout()" class="nav-btn" style="color: #666;">Salir (${user.name})</button>`;
            navHtml += `<button onclick="app.startBooking()" class="btn-primary">Reservar</button>`;
        } else {
            navHtml += `<button onclick="app.navigate('login')" class="nav-btn">Ingresar</button>`;
            navHtml += `<button onclick="app.startBooking()" class="btn-primary">Reservar Turno</button>`;
        }

        nav.innerHTML = navHtml;
    },

    startBooking(serviceId = null) {
        this.selectedService = serviceId;
        if (!state.currentUser) {
            this.showNotification('Por favor inicia sesión para reservar');
            localStorage.setItem('lumina_pending_service', this.selectedService || '');
            this.navigate('login');
        } else {
            this.navigate('booking');
        }
    },

    viewService(serviceId) {
        this.clickedService = serviceId; // Store temporarily
        this.navigate('service-detail', serviceId);
    },

    updateIcons() {
        if (window.lucide) {
            lucide.createIcons();
        }
    },

    showNotification(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    openModal(content) {
        const overlay = document.getElementById('modal-overlay');
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = content;
        overlay.classList.add('open');

        // Close on click outside
        overlay.onclick = (e) => {
            if (e.target === overlay) this.closeModal();
        }
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('open');
    },

    // Renders
    renderHome() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <section class="container hero">
                <div class="hero-content">
                    <h1 class="hero-title">Descubre tu mejor versión</h1>
                    <p class="hero-subtitle">Experiencias de bienestar y estética diseñadas exclusivamente para ti. Relájate, renueva y resplandece.</p>
                    <button onclick="app.navigate('services')" class="btn-secondary">Ver Tratamientos</button>
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

        // ENH-14: View All Button
        const container = document.querySelector('.section .container');
        container.insertAdjacentHTML('beforeend', `
            <div class="text-center" style="margin-top: 2rem;">
                 <button onclick="app.navigate('services')" class="btn-secondary">Ver todo el menú</button>
            </div>
        `);
    },

    renderServices(category = 'Todas') {
        const main = document.getElementById('main-content');

        const categories = ['Todas', ...new Set(state.services.map(s => s.category))];

        const filteredServices = category === 'Todas' ? state.services : state.services.filter(s => s.category === category);

        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2 class="section-title">Menú de Tratamientos</h2>
                        <p>Selecciona el tratamiento ideal para ti</p>
                    </div>

                    <!-- ENH-15: Tabs -->
                    <div class="filters">
                        ${categories.map(cat => `
                            <button onclick="app.renderServices('${cat}')" class="tab-btn ${cat === category ? 'active' : ''}">${cat}</button>
                        `).join('')}
                    </div>

                    <div class="services-grid">
                        ${filteredServices.map(s => this.createServiceCard(s)).join('')}
                    </div>
                    <div class="text-center" style="margin-top: 4rem;">
                        <a href="https://wa.me/1234567890" target="_blank" class="btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
                            <i data-lucide="message-circle"></i>Hacé tu consulta por WhatsApp
                        </a>
                    </div>
                </div>
            </section>
        `;
        this.updateIcons();
    },

    renderServiceDetail(id) {
        const service = state.services.find(s => s.id === id);
        if (!service) return this.navigate('services');

        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="detail-header">
                <div class="container text-center">
                    <button onclick="app.navigate('services')" class="btn-secondary" style="background:transparent; border-color:white; color: white; margin-bottom: 2rem;">← Volver</button>
                    <h1 style="font-size: 3rem; margin-bottom: 1rem;">${service.name}</h1>
                    <p style="font-size: 1.25rem; opacity: 0.9;">${service.intro || service.description}</p>
                </div>
            </div>
            
            <section class="container" style="padding: 0 1.5rem 4rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center;">
                    <div>
                        <h2 style="margin-bottom: 1.5rem;">Beneficios Clave</h2>
                        <ul class="benefit-list">
                            ${(service.benefits || []).map(b => `<li>${b}</li>`).join('')}
                        </ul>
                        <div style="background: #f8f8f8; padding: 1.5rem; border-radius: var(--radius-lg); margin-top: 2rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>Duración:</span>
                                <strong>${service.duration} mins</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem;">
                                <span>Precio Estimado:</span>
                                <strong>${service.priceRange || '$' + service.price}</strong>
                            </div>
                            <button onclick="app.startBooking(${service.id})" class="btn-primary" style="width: 100%; text-align: center;">Reservar Ahora</button>
                        </div>
                    </div>
                    <div>
                         <div style="background: #eee; height: 400px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="${service.icon}" size="96" style="color: #ccc"></i>
                         </div>
                    </div>
                </div>
            </section>
        `;
    },

    renderProfessionals() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2 class="section-title">Nuestros Profesionales</h2>
                        <p>Conoce al equipo de expertos dedicado a tu bienestar</p>
                    </div>
                    <div class="services-grid">
                        ${state.professionals.map(p => `
                            <div class="service-card text-center" onclick="app.navigate('professional-profile', ${p.id})" style="cursor: pointer; transition: transform 0.2s;">
                                <div style="width: 100px; height: 100px; background: #eee; border-radius: 50%; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                    ${p.image
                ? `<img src="${p.image}" alt="${p.name}" class="prof-img">`
                : `<i data-lucide="user" size="48" style="color: #ccc;"></i>`
            }
                                </div>
                                <h3>${p.name}</h3>
                                <p style="color: var(--primary); font-weight: 500; margin-bottom: 0.5rem;">${p.specialty}</p>
                                <p style="color: #666; font-size: 0.9rem;">Especialista en ${p.serviceIds.map(id => state.services.find(s => s.id === id)?.name).join(', ')}</p>
                                <button class="btn-secondary" style="margin-top: 1rem; padding: 4px 12px; font-size: 0.9rem;">Ver Perfil</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>
        `;
    },

    renderProfessionalProfile(id) {
        const p = state.professionals.find(prof => prof.id == id);
        if (!p) return this.navigate('professionals');

        const main = document.getElementById('main-content');
        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <button onclick="app.navigate('professionals')" class="btn-secondary" style="margin-bottom: 2rem;">← Volver</button>
                    
                    <div style="background: white; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md);">
                        <div style="background: linear-gradient(135deg, var(--primary-light), white); padding: 3rem 1.5rem; text-align: center;">
                            <div style="width: 120px; height: 120px; background: white; border-radius: 50%; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; border: 4px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                                ${p.image
                ? `<img src="${p.image}" alt="${p.name}" class="prof-img">`
                : `<i data-lucide="user" size="64" style="color: #ccc;"></i>`
            }
                            </div>
                            <h2 style="margin-bottom: 0.5rem;">${p.name}</h2>
                            <p style="color: var(--primary-dark); font-weight: 600;">${p.specialty}</p>
                        </div>
                        
                        <div style="padding: 2rem; max-width: 800px; margin: 0 auto;">
                            <h3 class="mb-4">Sobre mí</h3>
                            <p style="color: #666; line-height: 1.6; margin-bottom: 2rem;">
                                Profesional apasionada/o por la estética y el bienestar. Especialista en ${p.serviceIds.map(sid => state.services.find(s => s.id === sid)?.name).join(' y ')}. 
                                Con años de experiencia brindando tratamientos personalizados para realzar tu belleza natural.
                            </p>

                            <h3 class="mb-4">Especialidades</h3>
                            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 3rem;">
                                ${p.serviceIds.map(sid => {
                const s = state.services.find(ser => ser.id === sid);
                return `<span style="background: #f0fdf9; color: #047857; padding: 6px 16px; border-radius: 20px; border: 1px solid #ccfbf1;">${s.name}</span>`;
            }).join('')}
                            </div>

                            <div class="text-center">
                                <button onclick="app.startBooking(null)" class="btn-primary" style="padding: 1rem 3rem;">Solicitar Turno con ${p.name.split(' ')[0]}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
        this.updateIcons();
    },

    createServiceCard(service) {
        return `
            <div class="service-card" onclick="app.viewService(${service.id})">
                <div class="service-icon">
                    <i data-lucide="${service.icon}"></i>
                </div>
                <h3>${service.name}</h3>
                <p style="color: #666; margin: 0.5rem 0;">${service.description}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem;">
                    <div>
                        <span style="display:block; font-size: 0.8rem; color: #999;">Precio estimado</span>
                        <span style="font-weight: 600; color: var(--primary-dark);">${service.priceRange || '$' + service.price}</span>
                    </div>
                    <span style="color: #999; font-size: 0.9rem;">${service.duration} min</span>
                </div>
                <div style="margin-top: 1rem; text-align: right;">
                    <span style="font-size: 0.9rem; color: var(--primary); font-weight: 600;">Ver Detalles →</span>
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
                        <h2 class="text-center mb-4">${state.rescheduleId ? 'Reagendar Turno' : 'Reserva tu Turno'}</h2>
                        ${state.rescheduleId ? '<div style="background: #e0f2fe; color: #0369a1; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; text-align: center;">Estás reagendando un turno existente. El anterior será cancelado automáticamente al confirmar.</div>' : ''}
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
            </section >
    `;

        if (state.currentUser) {
            const nameInput = document.querySelector('input[name="name"]');
            const emailInput = document.querySelector('input[name="email"]');
            if (nameInput) nameInput.value = state.currentUser.name;
            if (emailInput) {
                emailInput.value = state.currentUser.email;
                emailInput.readOnly = true; // Lock email to ensure it matches account
                emailInput.style.backgroundColor = "#f0f0f0";
            }
        }

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
        const startTotalMinutes = 9 * 60; // 09:00
        const endTotalMinutes = 18 * 60;  // 18:00
        const lunchStart = 13 * 60;       // 13:00
        const lunchEnd = 14 * 60;         // 14:00

        // Get existing bookings for this professional on this date
        const existingBookings = state.bookings.filter(b =>
            b.professionalId == profId && b.date === date
        );

        // ENH-17: Filter past times
        const now = new Date();
        const [y, m, d] = date.split('-').map(Number);
        const selectedDate = new Date(y, m - 1, d);
        const isToday = selectedDate.getDate() === now.getDate() &&
            selectedDate.getMonth() === now.getMonth() &&
            selectedDate.getFullYear() === now.getFullYear();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        for (let currentTime = startTotalMinutes; currentTime + duration <= endTotalMinutes; currentTime += duration) {

            // Skip past times if today
            if (isToday && currentTime <= currentMinutes) continue;

            // Check if slot overlaps with lunch break
            const slotEnd = currentTime + duration;
            // Overlap logic: Start < LunchEnd AND End > LunchStart
            const overlapsLunch = (currentTime < lunchEnd && slotEnd > lunchStart);

            // Booking overlap check
            const isBooked = existingBookings.some(b => {
                const [bHour, bMin] = b.time.split(':').map(Number);
                const bStart = bHour * 60 + bMin;
                const bService = state.services.find(s => s.name === b.serviceName); // Fallback if no ID in old records
                const bDuration = bService ? bService.duration : 60;
                const bEnd = bStart + bDuration;

                // Overlap: NewStart < ExistingEnd AND NewEnd > ExistingStart
                return (currentTime < bEnd && slotEnd > bStart);
            });

            if (!overlapsLunch) {
                // Convert minutes back to HH:MM format
                const hours = Math.floor(currentTime / 60);
                const minutes = currentTime % 60;
                const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} `;

                times.push({
                    time: timeStr,
                    available: !isBooked
                });
            }
        }

        if (times.length === 0) {
            slotsContainer.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: #d9534f;">No hay turnos disponibles para esta fecha.</p>';
        } else {
            slotsContainer.innerHTML = times.map(slot => `
    < div class="time-slot ${slot.available ? '' : 'disabled'}" 
                     ${slot.available ? `onclick="app.selectTime(this, '${slot.time}')"` : ''}>
    ${slot.time}
                </div >
    `).join('');
        }
    },

    selectTime(el, time) {
        document.querySelectorAll('.time-slot').forEach(d => d.classList.remove('selected'));
        el.classList.add('selected');
        document.getElementById('selected-time').value = time;
    },

    handleBookingSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Basic validation
        if (!formData.get('time')) {
            this.showNotification('Por favor selecciona un horario.');
            return;
        }

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
        // Sort bookings by date/time
        state.bookings.sort((a, b) => {
            const dateA = new Date(a.date + 'T' + a.time);
            const dateB = new Date(b.date + 'T' + b.time);
            return dateA - dateB;
        });

        // ENH-19: Handle Reschedule
        if (state.rescheduleId) {
            const oldBooking = state.bookings.find(b => b.id === state.rescheduleId);
            if (oldBooking) {
                oldBooking.status = 'Cancelado'; // Or keep it simple
                // Maybe add a note or flag?
            }
            state.rescheduleId = null;
            this.showNotification('Turno reagendado con éxito');
        }

        localStorage.setItem('lumina_bookings', JSON.stringify(state.bookings));

        this.showEmailModal(booking);
    },

    showEmailModal(booking) {
        const content = `
            <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid #eee;">
                <button onclick="app.switchChannel('email')" id="btn-email" class="tab-btn active" style="padding-bottom: 0.5rem;">Email</button>
                <button onclick="app.switchChannel('whatsapp')" id="btn-whatsapp" class="tab-btn" style="padding-bottom: 0.5rem;">WhatsApp</button>
                <button onclick="app.switchChannel('sms')" id="btn-sms" class="tab-btn" style="padding-bottom: 0.5rem;">SMS</button>
            </div>
            
            <div id="content-email" class="channel-content">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <div style="background: #e6fffa; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                        <i data-lucide="mail-check" style="color: #047857; width: 32px; height: 32px;"></i>
                    </div>
                    <h2>¡Reserva Confirmada!</h2>
                    <p style="color: #666;">Hemos enviado un correo a <strong>${booking.clientEmail}</strong></p>
                </div>
                <div style="background: #f8fafc; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; text-align: left; font-family: monospace; font-size: 0.9rem; color: #475569; position: relative;">
                    <p style="margin-bottom: 0.5rem;"><strong>Asunto:</strong> Confirmación de Turno - JuliEsteve</p>
                    <p>Hola ${booking.clientName}, tu turno para <strong>${booking.serviceName}</strong> con ${booking.professionalName} el ${booking.date} a las ${booking.time} está confirmado.</p>
                </div>
            </div>

            <div id="content-whatsapp" class="channel-content" style="display:none;">
                <div style="text-align: center; margin-bottom: 2rem;">
                     <div style="background: #e5ffeb; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                        <i data-lucide="message-circle" style="color: #25D366; width: 32px; height: 32px;"></i>
                    </div>
                    <h2>Enviar Confirmación</h2>
                    <p style="color: #666;">Envía los detalles por WhatsApp</p>
                </div>
                <div style="background: #e5ffeb; padding: 1rem; border-radius: 8px; text-align: left; margin-bottom: 1rem; color: #1f2937;">
                    <p>Hola *${booking.clientName}*! 👋<br>Te confirmamos tu turno en *JuliEsteve*:<br>✨ Tratamiento: ${booking.serviceName}<br>📅 Fecha: ${booking.date}<br>⏰ Hora: ${booking.time}<br>📍 Te esperamos!</p>
                </div>
                <a href="https://wa.me/?text=Hola ${encodeURIComponent(booking.clientName)}! Te confirmamos tu turno: ${booking.serviceName} el ${booking.date} a las ${booking.time}." target="_blank" class="btn-primary" style="background: #25D366; border-color: #25D366; width: 100%; display: block; text-align: center; text-decoration: none;">Abrir WhatsApp</a>
            </div>

             <div id="content-sms" class="channel-content" style="display:none;">
                <div style="text-align: center; margin-bottom: 2rem;">
                     <div style="background: #f3f4f6; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                        <i data-lucide="smartphone" style="color: #4b5563; width: 32px; height: 32px;"></i>
                    </div>
                     <h2>Enviar SMS</h2>
                </div>
                <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px; text-align: left; margin-bottom: 1rem; font-family: monospace;">
                    <p>JuliEsteve: Turno confirmado para ${booking.serviceName} el ${booking.date} ${booking.time}.</p>
                </div>
                <button onclick="app.showNotification('SMS enviado (simulado)')" class="btn-primary" style="width: 100%; background: #4b5563; border-color: #4b5563;">Simular Envío SMS</button>
            </div>

            <button onclick="app.closeModal(); app.navigate('home')" class="btn-secondary" style="width: 100%; margin-top: 1rem;">Cerrar</button>
        `;

        this.openModal(content);
        if (window.lucide) lucide.createIcons();
    },

    switchChannel(channel) {
        document.querySelectorAll('.channel-content').forEach(el => el.style.display = 'none');
        document.getElementById(`content-${channel}`).style.display = 'block';
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`btn-${channel}`).classList.add('active');
    },

    // ENH-26/27: Patient Management
    renderPatients() {
        const main = document.getElementById('main-content');
        const user = state.currentUser;

        // Filter patients based on role
        let visiblePatients = [];
        if (user.role === 'admin') {
            visiblePatients = state.patients;
        } else if (user.role === 'professional') {
            // Get emails of clients who have booked with this professional
            const myClientEmails = new Set(
                state.bookings
                    .filter(b => parseInt(b.professionalId) === user.id)
                    .map(b => b.clientEmail)
            );
            visiblePatients = state.patients.filter(p => myClientEmails.has(p.email));
        }

        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2>Gestión de Pacientes</h2>
                        <p>${user.role === 'professional' ? 'Pacientes atendidos por ti' : 'Listado maestro de pacientes'}</p>
                    </div>
                    
                    <div class="mb-4">
                        <input type="text" placeholder="Buscar por nombre, email o teléfono..." class="form-input" style="max-width: 400px; margin: 0 auto; display: block;" onkeyup="app.filterPatients(this.value)">
                    </div>

                    <div style="overflow-x: auto;">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Email</th>
                                    <th>Teléfono</th>
                                    <th>Última Visita</th>
                                    <th>Total Turnos</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody id="patients-table-body">
                                ${visiblePatients.length ? visiblePatients.map(p => `
                                    <tr>
                                        <td>${p.name}</td>
                                        <td>${p.email}</td>
                                        <td>${p.phone}</td>
                                        <td>${p.lastVisit}</td>
                                        <td>${p.totalVisits}</td>
                                        <td>
                                            <button onclick="app.navigate('patient-profile', '${p.email}')" style="background: var(--primary); color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer;">Ver Perfil</button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="6" class="text-center">No se encontraron pacientes.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        `;

        // Store for filtering
        this.currentPatientList = visiblePatients;
    },

    filterPatients(query) {
        const tbody = document.getElementById('patients-table-body');
        const lowerQuery = query.toLowerCase();

        const filtered = this.currentPatientList.filter(p =>
            p.name.toLowerCase().includes(lowerQuery) ||
            p.email.toLowerCase().includes(lowerQuery) ||
            (p.phone && p.phone.includes(query))
        );

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No se encontraron pacientes que coincidan.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>${p.email}</td>
                <td>${p.phone}</td>
                <td>${p.lastVisit}</td>
                <td>${p.totalVisits}</td>
                <td>
                    <button onclick="app.navigate('patient-profile', '${p.email}')" style="background: var(--primary); color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer;">Ver Perfil</button>
                </td>
            </tr>
        `).join('');
    },

    renderPatientProfile(email) {
        const p = state.patients.find(pt => pt.email === email);
        if (!p) return this.navigate('patients');

        const user = state.currentUser;
        let pBookings = state.bookings.filter(b => b.clientEmail === email);

        if (user.role === 'professional') {
            pBookings = pBookings.filter(b => parseInt(b.professionalId) === user.id);
        }

        // Sort desc
        pBookings.sort((a, b) => new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time));

        const main = document.getElementById('main-content');
        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <button onclick="app.navigate('patients')" class="btn-secondary" style="margin-bottom: 2rem;">← Volver al Listado</button>
                    
                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
                        <!-- Profile Card -->
                        <div style="background: white; padding: 2rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-md); height: fit-content;">
                            <div style="text-align: center; margin-bottom: 1.5rem;">
                                <div style="width: 80px; height: 80px; background: #eee; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center;">
                                    <i data-lucide="user" size="40" style="color: #666;"></i>
                                </div>
                                <h3>${p.name}</h3>
                                <p style="color: #666;">${p.email}</p>
                            </div>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 1.5rem 0;">
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">Teléfono</label>
                                <div style="display: flex; gap: 0.5rem;">
                                    <input type="text" value="${p.phone}" id="edit-phone" class="form-input" style="padding: 0.5rem;">
                                    <button onclick="app.savePhone('${p.email}')" style="padding: 0 1rem; border: 1px solid #ddd; background: #f8f8f8; cursor: pointer;">💾</button>
                                </div>
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">Visitas Totales</label>
                                <p>${p.totalVisits}</p>
                            </div>
                            <div>
                                <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">Última Visita</label>
                                <p>${p.lastVisit}</p>
                            </div>
                        </div>

                        <!-- History -->
                        <div>
                             <h3 style="margin-bottom: 1rem;">Historial de Turnos</h3>
                             ${pBookings.length ? pBookings.map(b => `
                                <div class="dashboard-card">
                                    <div>
                                        <strong>${b.serviceName}</strong>
                                        <div style="font-size: 0.9rem; color: #666; margin-top: 0.25rem;">
                                            📅 ${b.date} ⏰ ${b.time}
                                            <br>
                                            👨‍⚕️ ${b.professionalName}
                                        </div>
                                    </div>
                                    <div>
                                        <span class="status-badge ${b.status.toLowerCase()}">
                                            ${b.status}
                                        </span>
                                    </div>
                                </div>
                             `).join('') : '<p>No hay historial disponible.</p>'}
                        </div>
                    </div>
                </div>
            </section>
        `;
        this.updateIcons();
    },

    savePhone(email) {
        const phone = document.getElementById('edit-phone').value;
        const p = state.patients.find(pt => pt.email === email);
        if (p) {
            p.phone = phone;
            localStorage.setItem('lumina_patients', JSON.stringify(state.patients));
            this.showNotification('Teléfono actualizado');
        }
    },


    // ENH-24: Module Visits
    registerVisit(bookingId) {
        const booking = state.bookings.find(b => b.id === bookingId);
        if (!booking) return;

        const content = `
            <h3 class="mb-4">Registrar Visita</h3>
            <p style="color: #666; margin-bottom: 1rem;">${booking.serviceName} - ${booking.clientName}</p>
            <form onsubmit="app.saveVisit(event, ${bookingId})">
                <div class="form-group">
                    <label class="form-label">Tratamiento Realizado</label>
                    <input type="text" name="treatment" class="form-input" value="${booking.serviceName}" required>
                </div>
                 <div class="form-group">
                    <label class="form-label">Unidades / Detalles</label>
                    <input type="text" name="units" class="form-input" placeholder="Ej: 2 viales, 1 sesión...">
                </div>
                <div class="form-group">
                    <label class="form-label">Precio Cobrado ($)</label>
                    <input type="number" name="price" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Forma de Pago</label>
                    <select name="paymentMethod" class="form-select" required>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Tarjeta">Tarjeta</option>
                        <option value="Transferencia">Transferencia</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Notas Internas</label>
                    <textarea name="notes" class="form-input" rows="3"></textarea>
                </div>
                <button type="submit" class="btn-primary" style="width: 100%;">Guardar Visita</button>
            </form>
        `;
        this.openModal(content);
    },

    saveVisit(e, bookingId) {
        e.preventDefault();
        const formData = new FormData(e.target);

        const visit = {
            id: Date.now(),
            bookingId: bookingId,
            date: new Date().toISOString().split('T')[0],
            professionalId: state.currentUser.id,
            treatment: formData.get('treatment'),
            units: formData.get('units'),
            price: parseFloat(formData.get('price')),
            paymentMethod: formData.get('paymentMethod'),
            notes: formData.get('notes')
        };

        state.visits.push(visit);
        localStorage.setItem('lumina_visits', JSON.stringify(state.visits));

        // Update booking status
        const booking = state.bookings.find(b => b.id === bookingId);
        if (booking) {
            booking.status = 'Completado';
            localStorage.setItem('lumina_bookings', JSON.stringify(state.bookings));
        }

        this.syncPatients(); // Update patient stats
        this.closeModal();
        this.showNotification('Visita registrada correctamente');
        this.renderMyBookings();
    },

    // ENH-25: Reports
    renderReports() {
        // Only Admin
        if (state.currentUser.role !== 'admin') return;

        const main = document.getElementById('main-content');

        // Calculate Totals by Professional
        const reportData = {};

        state.visits.forEach(v => {
            if (!reportData[v.professionalId]) {
                reportData[v.professionalId] = {
                    name: state.professionals.find(p => p.id === parseInt(v.professionalId))?.name || 'Desconocido',
                    cash: 0, card: 0, transfer: 0, total: 0
                };
            }

            const amount = v.price || 0;
            if (v.paymentMethod === 'Efectivo') reportData[v.professionalId].cash += amount;
            else if (v.paymentMethod === 'Tarjeta') reportData[v.professionalId].card += amount;
            else if (v.paymentMethod === 'Transferencia') reportData[v.professionalId].transfer += amount;

            reportData[v.professionalId].total += amount;
        });

        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2>Reporte de Ingresos</h2>
                        <p>Resumen financiero por profesional</p>
                    </div>
                    
                    <button onclick="app.navigate('admin')" class="btn-secondary" style="margin-bottom: 2rem;">← Volver a Reservas</button>

                    <div style="overflow-x: auto;">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Profesional</th>
                                    <th>Efectivo</th>
                                    <th>Tarjeta</th>
                                    <th>Transferencia</th>
                                    <th>TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.values(reportData).map(row => `
                                    <tr>
                                        <td><strong>${row.name}</strong></td>
                                        <td>$${row.cash}</td>
                                        <td>$${row.card}</td>
                                        <td>$${row.transfer}</td>
                                        <td style="color: var(--primary-dark); font-weight: bold;">$${row.total}</td>
                                    </tr>
                                `).join('')}
                                ${Object.keys(reportData).length === 0 ? '<tr><td colspan="5" class="text-center">No hay visitas registradas aún.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        `;
    },



    // ENH-22/23: Admin Filters
    applyAdminFilters() {
        state.adminFilters.professionalId = document.getElementById('filter-prof').value;
        state.adminFilters.status = document.getElementById('filter-status').value;
        state.adminFilters.month = document.getElementById('filter-month').value;
        this.renderAdmin();
    },

    renderAdmin() {
        const main = document.getElementById('main-content');

        // Filter Logic
        let filteredBookings = state.bookings;

        if (state.adminFilters.professionalId) {
            filteredBookings = filteredBookings.filter(b => b.professionalId == state.adminFilters.professionalId);
        }
        if (state.adminFilters.status) {
            filteredBookings = filteredBookings.filter(b => b.status === state.adminFilters.status);
        }
        if (state.adminFilters.month) {
            filteredBookings = filteredBookings.filter(b => b.date.startsWith(state.adminFilters.month));
        }

        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2>Panel de Administración</h2>
                        <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                             <button onclick="app.navigate('reports')" class="btn-secondary">Reportes Financieros</button>
                             <button onclick="app.navigate('patients')" class="btn-secondary">Maestro Pacientes</button>
                        </div>
                    </div>

                    <!-- Filters Toolbar -->
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: end; border: 1px solid #e2e8f0;">
                        <div style="flex: 1; min-width: 200px;">
                            <label style="display: block; font-size: 0.8rem; margin-bottom: 0.25rem; font-weight: 600; color: #64748b;">Profesional</label>
                            <select id="filter-prof" class="form-select" style="margin:0;" onchange="app.applyAdminFilters()">
                                <option value="">Todos</option>
                                ${state.professionals.map(p => `<option value="${p.id}" ${state.adminFilters.professionalId == p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                            </select>
                        </div>
                         <div style="flex: 1; min-width: 150px;">
                            <label style="display: block; font-size: 0.8rem; margin-bottom: 0.25rem; font-weight: 600; color: #64748b;">Estado</label>
                            <select id="filter-status" class="form-select" style="margin:0;" onchange="app.applyAdminFilters()">
                                <option value="">Todos</option>
                                <option value="Confirmado" ${state.adminFilters.status === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
                                <option value="Completado" ${state.adminFilters.status === 'Completado' ? 'selected' : ''}>Completado</option>
                                <option value="Cancelado" ${state.adminFilters.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                            </select>
                        </div>
                        <div style="flex: 1; min-width: 150px;">
                            <label style="display: block; font-size: 0.8rem; margin-bottom: 0.25rem; font-weight: 600; color: #64748b;">Mes</label>
                            <input type="month" id="filter-month" class="form-input" style="margin:0;" value="${state.adminFilters.month}" onchange="app.applyAdminFilters()">
                        </div>
                        <div style="display: flex; align-items: end;">
                            <button onclick="state.adminFilters={professionalId:'',status:'',month:''}; app.renderAdmin()" style="padding: 0.5rem 1rem; border: none; background: transparent; color: #666; cursor: pointer; text-decoration: underline;">Limpiar</button>
                        </div>
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
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredBookings.length ? filteredBookings.map(b => `
                                    <tr>
                                        <td>${b.date}</td>
                                        <td>${b.time}</td>
                                        <td><strong>${b.professionalName || '-'}</strong></td>
                                        <td>${b.clientName}</td>
                                        <td>${b.serviceName}</td>
                                        <td><span class="status-badge ${b.status.toLowerCase()}">${b.status}</span></td>
                                        <td>
                                            <button onclick="app.editBooking(${b.id})" style="background: none; border: 1px solid #ddd; padding: 4px 8px; cursor: pointer; border-radius: 4px;">Editar</button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="7" class="text-center">No hay reservas con estos filtros.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        `;
    },

    renderLogin() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="login-container">
                        <div class="login-header">
                            <h2>Iniciar Sesión</h2>
                            <p>Accede a tu cuenta para gestionar tus turnos</p>
                        </div>
                        <form onsubmit="event.preventDefault(); app.login(this.email.value, this.password.value)">
                            <div class="form-group">
                                <label class="form-label text-left">Email</label>
                                <input type="email" name="email" class="form-input" required placeholder="tu@email.com">
                            </div>
                            <div class="form-group">
                                <label class="form-label text-left">Contraseña</label>
                                <input type="password" name="password" class="form-input" required>
                            </div>
                            <button type="submit" class="btn-primary" style="width: 100%">Ingresar</button>
                            <div class="text-center" style="margin-top: 1rem;">
                                <a href="#" onclick="event.preventDefault(); app.forgotPassword()" style="color: var(--primary); font-size: 0.9rem;">¿Olvidaste tu contraseña?</a>
                            </div>
                        </form>
                        <div class="auth-btn-group">
                            <button onclick="app.login('admin@julielle.com', 'admin')" style="background:none; border:none; color: #999; cursor: pointer; text-decoration: underline;">Demo Admin</button>
                            <button onclick="app.login('paciente@test.com', '123')" style="background:none; border:none; color: #999; cursor: pointer; text-decoration: underline;">Demo Paciente</button>
                            <button onclick="app.login('profesional@julielle.com', 'prof')" style="background:none; border:none; color: #999; cursor: pointer; text-decoration: underline;">Demo Prof</button>
                        </div>
                         <div style="margin-top: 2rem; border-top: 1px solid #eee; padding-top: 1rem;">
                            <p>¿No tienes cuenta?</p>
                            <button onclick="app.navigate('register')" class="btn-secondary" style="margin-top: 0.5rem; width: 100%;">Crear cuenta</button>
                        </div>
                    </div>
                </div>
            </section>
        `;
    },

    renderRegister() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="login-container">
                        <div class="login-header">
                            <h2>Crear Cuenta</h2>
                            <p>Regístrate para reservar tus turnos</p>
                        </div>
                        <form onsubmit="event.preventDefault(); app.register(this)">
                            <div class="form-group">
                                <label class="form-label text-left">Nombre Completo</label>
                                <input type="text" name="name" class="form-input" required placeholder="Tu nombre">
                            </div>
                            <div class="form-group">
                                <label class="form-label text-left">Email</label>
                                <input type="email" name="email" class="form-input" required placeholder="tu@email.com">
                            </div>
                            <div class="form-group">
                                <label class="form-label text-left">Contraseña</label>
                                <input type="password" name="password" class="form-input" required>
                            </div>
                            <button type="submit" class="btn-primary" style="width: 100%">Registrarse</button>
                        </form>
                        <div style="margin-top: 2rem; border-top: 1px solid #eee; padding-top: 1rem;">
                            <p>¿Ya tienes cuenta?</p>
                            <button onclick="app.navigate('login')" class="btn-secondary" style="margin-top: 0.5rem; width: 100%;">Iniciar Sesión</button>
                        </div>
                    </div>
                </div>
            </section>
        `;
    },

    register(form) {
        const name = form.name.value;
        const email = form.email.value;
        const password = form.password.value;

        if (state.users.find(u => u.email === email)) {
            alert('El email ya está registrado');
            return;
        }

        const newUser = {
            email,
            password,
            name,
            role: 'patient'
        };

        state.users.push(newUser);
        this.showNotification('Cuenta creada con éxito. Iniciando sesión...');
        this.login(email, password);
    },

    renderMyBookings() {
        const main = document.getElementById('main-content');

        let myBookings = [];
        let title = "Mis Turnos";
        let subtitle = "Gestiona tus próximas citas";

        if (state.currentUser.role === 'professional') {
            // If professional, verify ID from users match ID in bookings
            myBookings = state.bookings.filter(b => parseInt(b.professionalId) === state.currentUser.id);
            title = "Agenda Profesional";
            subtitle = "Pacientes asignados a tu agenda";
        } else {
            // If patient, filter by email
            myBookings = state.bookings.filter(b => b.clientEmail === state.currentUser.email);
        }

        main.innerHTML = `
    < section class="section" >
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">${title}</h2>
                <p>${subtitle}</p>
            </div>
            <div style="max-width: 800px; margin: 0 auto;">
                ${myBookings.length ? myBookings.map(b => {
            // Logic to determine what to show
            const isProfessional = state.currentUser.role === 'professional';
            const personIcon = "user";
            const personLabel = isProfessional ? `Paciente: ${b.clientName}` : `Profesional: ${b.professionalName}`;

            return `
                            <div class="dashboard-card">
                                <div>
                                    <h3 style="margin-bottom: 0.5rem;">${b.serviceName}</h3>
                                    <p style="color: #666; margin-bottom: 0.25rem;">
                                        <i data-lucide="calendar" style="width: 16px; display: inline-block; vertical-align: middle;"></i> 
                                        ${b.date} a las ${b.time}
                                    </p>
                                    <p style="color: #666;">
                                        <i data-lucide="${personIcon}" style="width: 16px; display: inline-block; vertical-align: middle;"></i> 
                                        <strong>${personLabel}</strong>
                                    </p>
                                </div>
                                <div class="text-center">
                                    <span class="status-badge ${b.status.toLowerCase()}">
                                        ${b.status}
                                    </span>
                                    <div style="display: flex; gap: 0.5rem; justify-content: center;">
                                        ${b.status !== 'Cancelado' && b.status !== 'Completado' ?
                    `<button onclick="app.cancelBooking(${b.id})" style="color: #ef4444; background: none; border: none; cursor: pointer; font-weight: 500;">Cancelar</button>`
                    : ''}
                                        ${b.status === 'Confirmado' ?
                    `<button onclick="app.rescheduleBooking(${b.id})" style="color: var(--primary); background: none; border: none; cursor: pointer; font-weight: 500;">Reagendar</button>`
                    : ''}
                                        ${state.currentUser.role === 'professional' && b.status === 'Confirmado' ?
                    `<button onclick="app.registerVisit(${b.id})" style="color: var(--primary-dark); background: none; border: 1px solid var(--primary); border-radius: 12px; padding: 2px 8px; cursor: pointer; font-weight: 600;">Registrar Visita</button>`
                    : ''}
                                    </div>
                                </div>
                            </div>
        `}).join('') : '<p class="text-center" style="color: #666; padding: 3rem;">No tienes turnos registrados.</p>'}
            </div>
        </div>
            </section >
    `;
    },

    showConfirmModal(message, onConfirm) {
        const content = `
            <div style="text-align: center; padding: 1rem;">
                <h3 style="margin-bottom: 1rem;">Confirmación</h3>
                <p style="color: #666; margin-bottom: 2rem;">${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button onclick="app.closeModal()" style="padding: 0.5rem 1rem; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    <button id="confirm-action-btn" class="btn-primary" style="background: #ef4444; border-color: #ef4444;">Confirmar</button>
                </div>
            </div>
        `;
        this.openModal(content);
        document.getElementById('confirm-action-btn').onclick = () => {
            this.closeModal();
            onConfirm();
        };
    },

    cancelBooking(id) {
        this.showConfirmModal('¿Estás seguro de que deseas cancelar este turno? Esta acción no se puede deshacer.', () => {
            const booking = state.bookings.find(b => b.id === id);
            if (booking) {
                booking.status = 'Cancelado';
                localStorage.setItem('lumina_bookings', JSON.stringify(state.bookings));
                this.showNotification('Turno cancelado');
                this.renderMyBookings();
            }
        });
    },

    // ENH-19: Reschedule
    rescheduleBooking(id) {
        const booking = state.bookings.find(b => b.id === id);
        if (!booking) return;
        state.rescheduleId = id;
        this.startBooking(booking.serviceId); // Navigate to booking with service pre-selected
    },

    editBooking(id) {
        const booking = state.bookings.find(b => b.id === id);
        if (!booking) return;

        const content = `
            <h3 class="mb-4">Editar Reserva</h3>
            <form onsubmit="app.updateBooking(event, ${id})">
                <div class="form-group">
                    <label class="form-label">Estado</label>
                    <select name="status" class="form-select">
                        <option value="Confirmado" ${booking.status === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
                        <option value="Cancelado" ${booking.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                        <option value="Completado" ${booking.status === 'Completado' ? 'selected' : ''}>Completado</option>
                    </select>
            </div>
            <div class="form-group">
                <label class="form-label">Fecha</label>
                <input type="date" name="date" class="form-input" value="${booking.date}" required>
            </div>
            <!-- Time is harder to edit without full logic loop, let's keep it simple for now -->
            <p style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">Para cambiar horario o profesional, por favor cancela y crea una nueva reserva para evitar conflictos.</p>

            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                <button type="button" onclick="app.closeModal()" style="flex: 1; padding: 0.75rem; border: 1px solid #ddd; background: white; border-radius: 50px; cursor: pointer;">Cancelar</button>
                <button type="submit" class="btn-primary" style="flex: 1;">Guardar Cambios</button>
            </div>
        </form>
`;
        this.openModal(content);
    },

    updateBooking(e, id) {
        e.preventDefault();
        const formData = new FormData(e.target);

        const bookingIndex = state.bookings.findIndex(b => b.id === id);
        if (bookingIndex > -1) {
            state.bookings[bookingIndex].status = formData.get('status');
            state.bookings[bookingIndex].date = formData.get('date');

            localStorage.setItem('lumina_bookings', JSON.stringify(state.bookings));

            this.closeModal();
            this.showNotification('Reserva actualizada');
            this.renderAdmin();
        }
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => app.init());
