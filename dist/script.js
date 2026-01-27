(function () {
    // Supabase Configuration
    const SUPABASE_URL = 'https://mmoaptsmulsuvdtepiot.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tb2FwdHNtdWxzdXZkdGVwaW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDgwNTgsImV4cCI6MjA4NDk4NDA1OH0.yvk_xOmDQFLgqNmvjJUd9Cnwvvm90Bnd26MrlyJj6bU';
    let supabase;


    // State
    const state = {
        services: [], // Will be fetched from DB
        professionals: [], // Will be fetched from DB
        bookings: [], // Will be fetched from DB
        currentUser: null, // Managed by Supabase Auth
        currentView: 'home',
        bookingFor: null,
        rescheduleId: null,
        patients: [], // Managed by profiles query
        visits: [],

        // UI Filters
        adminFilters: { professionalId: '', status: '', month: '' },
        reportFilters: { startDate: '', endDate: '', professionalId: '' },
        agendaView: { mode: 'list', calendarMonth: new Date().getMonth(), calendarYear: new Date().getFullYear(), selectedDay: null },
        visibleServicesCount: 4
    };

    // App Logic
    const turnoApp = {
        async init() {

            // Core initialization
            try {
                // 0. Check dependencies
                if (!window.supabase) {
                    throw new Error("Librería de conexión no disponible. Por favor verificá tu conexión a internet.");
                }
                // Initialize global client
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

                // 1. Check Session
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    await this.fetchUserProfile(session.user.id);
                }

                // 2. Load Data in Parallel
                await Promise.all([
                    this.fetchServices(),
                    this.fetchProfessionals()
                ]);

                // 3. UI
                this.renderHome();
                this.updateIcons();
                this.updateNav();

                // Listen for Auth Changes
                supabase.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'SIGNED_IN' && session) {
                        await this.fetchUserProfile(session.user.id);
                        await this.fetchBookings();
                    } else if (event === 'SIGNED_OUT') {
                        state.currentUser = null;
                        state.bookings = [];
                    }
                    this.updateNav();
                });

                // Handle Browser Back Button
                window.onpopstate = (event) => {
                    if (event.state) {
                        this.navigate(event.state.view, event.state.params, false);
                    } else {
                        this.navigate('home', null, false);
                    }
                };

            } catch (error) {
                console.error("Init Error:", error);
                // Fallback UI if toast not ready
                const msg = error.message || "Error de conexión";
                this.renderError(msg);
            }

            // Insert Modal HTML on init
            if (!document.getElementById('modal-overlay')) {
                document.body.insertAdjacentHTML('beforeend', `
                <div id="modal-overlay" class="modal-overlay">
                    <div id="modal-content" class="modal-content"></div>
                </div>
                <div id="toast" class="toast"></div>
                <a href="https://wa.me/1234567890" class="whatsapp-float" target="_blank" title="Consultar por WhatsApp">
                    <i data-lucide="message-circle" width="32" height="32"></i>
                </a>
            `);
            }
        },

        async fetchUserProfile(userId) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (data) {
                state.currentUser = data;
            }
        },

        async fetchServices() {
            const { data, error } = await supabase.from('services').select('*').order('id');
            if (data) state.services = data;
        },

        async fetchProfessionals() {
            const { data, error } = await supabase.from('professionals').select('*').order('id');
            if (data) {
                // Map snake_case DB fields to camelCase for frontend
                state.professionals = data.map(p => ({
                    ...p,
                    serviceIds: p.service_ids || [],
                    image: p.image_url
                }));
            }
        },

        navigate(view, params = null, pushState = true) {
            // Auth Guards
            if (view === 'admin' && (!state.currentUser || state.currentUser.role !== 'admin')) {
                return this.navigate('login');
            }
            if (view === 'my-bookings' && !state.currentUser) {
                return this.navigate('login');
            }
            if (view === 'booking' && !state.currentUser) {
                this.selectedService = this.selectedService || params; // Preserve service selection
                this.navigate('login');
                // Store intent
                localStorage.setItem('lumina_pending_action', JSON.stringify({ serviceId: this.selectedService }));
                this.showNotification('Debes iniciar sesión para reservar');
                return;
            }

            // Push History
            if (pushState) {
                const url = view === 'home' ? '/' : `#${view}`;
                history.pushState({ view, params }, '', url);
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

        async login(email, password) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                alert('Credenciales inválidas');
                return;
            }

            await this.fetchUserProfile(data.user.id);

            // Restore pending action or go home
            const pending = localStorage.getItem('lumina_pending_action');
            if (pending) {
                const { serviceId, professionalId } = JSON.parse(pending);
                localStorage.removeItem('lumina_pending_action');
                this.navigate('booking');
                // Note: We might want to pre-select, but navigate 'booking' usually handles the view.
                if (serviceId) this.selectedService = serviceId;
                if (professionalId) this.selectedProfessional = professionalId;
            } else {
                this.navigate('home');
            }
            this.updateNav();
        },

        async logout() {
            await supabase.auth.signOut();
            state.currentUser = null;
            state.bookingFor = null;
            this.navigate('home');
            this.updateNav();
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
            <button onclick="turnoApp.navigate('home')" class="nav-btn">Inicio</button>
            <button onclick="turnoApp.navigate('services')" class="nav-btn">Servicios</button>
            <button onclick="turnoApp.navigate('professionals')" class="nav-btn">Profesionales</button>
        `;

            if (user) {
                if (user.role === 'admin') {
                    navHtml += `<button onclick="turnoApp.navigate('admin')" class="nav-btn secondary">Admin</button>`;
                } else {
                    navHtml += `<button onclick="turnoApp.navigate('my-bookings')" class="nav-btn">Mis Turnos</button>`;
                }
                // ENH-26/27: Patient Management Button (Admin & Prof)
                if (user.role === 'admin' || user.role === 'professional') {
                    navHtml += `<button onclick="turnoApp.navigate('patients')" class="nav-btn">Pacientes</button>`;
                }

                navHtml += `<button onclick="turnoApp.logout()" class="nav-btn" style="color: #666;">Salir (${user.name})</button>`;
                navHtml += `<button onclick="turnoApp.startBooking()" class="btn-primary">Reservar</button>`;
            } else {
                navHtml += `<button onclick="turnoApp.navigate('login')" class="nav-btn">Ingresar</button>`;
                navHtml += `<button onclick="turnoApp.startBooking()" class="btn-primary">Reservar Turno</button>`;
            }

            nav.innerHTML = navHtml;
        },

        startBooking(serviceId = null, professionalId = null, bookingForEmail = null) {
            this.selectedService = serviceId;
            this.selectedProfessional = professionalId;
            state.bookingFor = bookingForEmail; // Set context if booking for someone else

            if (!state.currentUser) {
                this.showNotification('Por favor inicia sesión para reservar');
                // Save context
                const action = { serviceId, professionalId };
                localStorage.setItem('lumina_pending_action', JSON.stringify(action));

                // Legacy/Backup
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
        renderError(message) {
            const main = document.getElementById('main-content');
            // If main is not yet available (very early error), try app container
            const container = main || document.getElementById('app') || document.body;

            container.innerHTML = `
            <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h2 style="margin-bottom: 1rem; color: #d9534f;">Lo sentimos, hubo un problema</h2>
                <p style="color: #666; margin-bottom: 2rem; max-width: 400px;">${message}</p>
                <button onclick="window.location.reload()" class="btn-primary">Intentar nuevamente</button>
            </div>
         `;
        },

        renderHome() {

            const main = document.getElementById('main-content');
            main.innerHTML = `
            <section class="container hero">
                <div class="hero-content">
                    <h1 class="hero-title">Descubre tu mejor versión</h1>
                    <p class="hero-subtitle">Experiencias de bienestar y estética diseñadas exclusivamente para ti. Relájate, renueva y resplandece.</p>
                    <button onclick="turnoApp.navigate('services')" class="btn-secondary">Ver Tratamientos</button>
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
                    
                    <!-- ENH-01: Load More Button -->
                    <div class="text-center" style="margin-top: 2rem;" id="load-more-container">
                         <button onclick="turnoApp.loadMoreServices()" class="btn-secondary">+ Cargar más tratamientos</button>
                    </div>

                    <div class="text-center" style="margin-top: 2rem;">
                         <button onclick="turnoApp.navigate('services')" class="btn-secondary">Ver todo el catálogo completo</button>
                    </div>
                </div>
            </section>
        `;

            // Inject initial services
            this.renderFeaturedServices(state.visibleServicesCount);
        },

        renderFeaturedServices(limit) {
            const grid = document.getElementById('featured-services');
            grid.innerHTML = ''; // Clear current
            state.services.slice(0, limit).forEach(service => {
                grid.innerHTML += this.createServiceCard(service);
            });

            // Button visibility logic
            const btnContainer = document.getElementById('load-more-container');
            if (limit >= state.services.length) {
                btnContainer.style.display = 'none';
            } else {
                btnContainer.style.display = 'block';
            }

            this.updateIcons();
        },

        loadMoreServices() {
            state.visibleServicesCount += 4;
            this.renderFeaturedServices(state.visibleServicesCount);
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
                            <button onclick="turnoApp.renderServices('${cat}')" class="tab-btn ${cat === category ? 'active' : ''}">${cat}</button>
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
                    <button onclick="turnoApp.navigate('services')" class="btn-secondary" style="background:transparent; border-color:white; color: white; margin-bottom: 2rem;">← Volver a tratamientos</button>
                    <h1 style="font-size: 3rem; margin-bottom: 1rem;">${service.name}</h1>
                    <p style="font-size: 1.25rem; opacity: 0.9;">${service.intro || service.description}</p>
                </div>
            </div>
            
            <section class="container" style="padding: 0 1.5rem 4rem;">
                <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 4rem; margin-top: -3rem; position: relative; z-index: 2;">
                    <!-- Left Column: Details -->
                    <div style="background: white; padding: 2.5rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
                        <h2 style="margin-bottom: 1.5rem; color: var(--primary-dark);">Sobre el Tratamiento</h2>
                        <p style="color: #444; line-height: 1.7; margin-bottom: 2rem; font-size: 1.05rem;">
                            ${service.longDescription || service.description}
                        </p>

                         ${service.products ? `
                        <div style="margin-bottom: 2.5rem;">
                            <h3 style="font-size: 1.1rem; color: var(--primary); margin-bottom: 1rem; font-weight: 600;">Productos y Tecnología</h3>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                                ${service.products.map(p => `
                                    <span style="background: #f0f9ff; color: #0369a1; padding: 6px 14px; border-radius: 20px; font-size: 0.9rem; border: 1px solid #e0f2fe;">${p}</span>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}

                        <h3 style="font-size: 1.1rem; color: var(--primary); margin-bottom: 1rem; font-weight: 600;">Beneficios Clave</h3>
                        <ul class="benefit-list">
                            ${(service.benefits || []).map(b => `<li>${b}</li>`).join('')}
                        </ul>
                    </div>

                    <!-- Right Column: Card -->
                    <div>
                         <div style="background: white; padding: 2rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); position: sticky; top: 2rem;">
                             <div style="background: #f8f8f8; height: 250px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;">
                                <i data-lucide="${service.icon}" size="80" style="color: #ccc"></i>
                             </div>
                            
                            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #eee;">
                                <span style="color: #666;">Duración</span>
                                <strong style="color: var(--primary-dark);">${service.duration} mins</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2rem;">
                                <span style="color: #666;">Precio Estimado</span>
                                <strong style="font-size: 1.25rem; color: var(--primary-dark);">${service.priceRange || '$' + service.price}</strong>
                            </div>
                            
                            <button onclick="turnoApp.startBooking(${service.id})" class="btn-primary" style="width: 100%; text-align: center; justify-content: center; padding: 1rem;">
                                Reservar Turno
                            </button>
                            <p style="text-align: center; margin-top: 1rem; font-size: 0.85rem; color: #888;">Reserva fácil y segura</p>
                        </div>
                    </div>
                </div>
            </section>
        `;
            this.updateIcons();
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
                            <div class="service-card text-center" onclick="turnoApp.navigate('professional-profile', ${p.id})" style="cursor: pointer; transition: transform 0.2s;">
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
                    <button onclick="turnoApp.navigate('professionals')" class="btn-secondary" style="margin-bottom: 2rem;">← Volver</button>
                    
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

                            <h3 class="mb-4">Tipos de turnos</h3>
                            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 3rem;">
                                ${p.serviceIds.map(sid => {
                    const s = state.services.find(ser => ser.id === sid);
                    return `<span style="background: #f0fdf9; color: #047857; padding: 6px 16px; border-radius: 20px; border: 1px solid #ccfbf1;">${s.name}</span>`;
                }).join('')}
                            </div>

                            <div class="text-center">
                                <button onclick="turnoApp.startBooking(null, ${p.id})" class="btn-primary" style="padding: 1rem 3rem;">Solicitar Turno con ${p.name.split(' ')[0]}</button>
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
            <div class="service-card" onclick="turnoApp.viewService(${service.id})">
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
                    <button onclick="window.history.back()" class="btn-secondary" style="margin-bottom: 1rem;">← Volver</button>
                    <div class="booking-container">
                        <h2 class="text-center mb-4">${state.rescheduleId ? 'Reagendar Turno' : 'Reserva tu Turno'}</h2>
                        ${state.rescheduleId ? '<div style="background: #e0f2fe; color: #0369a1; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; text-align: center;">Estás reagendando un turno existente. El anterior será cancelado automáticamente al confirmar.</div>' : ''}
                        <form id="booking-form" onsubmit="turnoApp.handleBookingSubmit(event)">
                            <div class="form-group">
                                <label class="form-label">Servicio</label>
                                <select class="form-select" name="service" id="service-select" required onchange="turnoApp.filterProfessionals()">
                                    <option value="">Selecciona un servicio</option>
                                    ${state.services
                    .filter(s => state.professionals.some(p => p.serviceIds.includes(s.id)))
                    .map(s =>
                        `<option value="${s.id}" ${s.id === defaultService ? 'selected' : ''}>${s.name} - $${s.price}</option>`
                    ).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Profesional</label>
                                <select class="form-select" name="professional" id="professional-select" required onchange="turnoApp.generateTimeSlots()" disabled>
                                    <option value="">Primero selecciona un servicio</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Fecha</label>
                                <input type="date" class="form-input" name="date" required min="${new Date().toISOString().split('T')[0]}" onchange="turnoApp.generateTimeSlots()">
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

            // Pre-select professional if set
            if (this.selectedProfessional) {
                const profSelect = document.getElementById('professional-select');
                // Check if the professional is in the options (it might not be if service doesn't match, but logic should handle it)
                if (profSelect.querySelector(`option[value="${this.selectedProfessional}"]`)) {
                    profSelect.value = this.selectedProfessional;
                }
                // Clear it after using so it doesn't persist improperly across navigations if not intended
                this.selectedProfessional = null;
            }
        },

        filterProfessionals() {
            const serviceId = document.getElementById('service-select').value;
            const profSelect = document.getElementById('professional-select');

            profSelect.innerHTML = '<option value="">Selecciona un profesional</option>';
            profSelect.disabled = !serviceId;

            if (!serviceId) return;

            const availableProfs = state.professionals.filter(p => p.serviceIds.includes(parseInt(serviceId)));

            if (availableProfs.length === 0) {
                profSelect.innerHTML = '<option value="">No hay profesionales disponibles</option>';
                profSelect.disabled = true;
                return;
            }

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
                <div class="time-slot ${slot.available ? '' : 'disabled'}" 
                     ${slot.available ? `onclick="turnoApp.selectTime(this, '${slot.time.trim()}')"` : ''}>
                    ${slot.time}
                </div>
            `).join('');
            }
        },

        selectTime(el, time) {
            document.querySelectorAll('.time-slot').forEach(d => d.classList.remove('selected'));
            el.classList.add('selected');
            document.getElementById('selected-time').value = time;
        },



        async fetchBookings() {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                *,
                services (name),
                professionals (name)
            `)
                .order('date', { ascending: true });

            if (data) {
                state.bookings = data.map(b => ({
                    ...b,
                    serviceName: b.services ? b.services.name : 'Servicio',
                    professionalName: b.professionals ? b.professionals.name : 'Profesional',
                    serviceId: b.service_id,
                    professionalId: b.professional_id,
                    clientName: b.patient_name,
                    clientEmail: b.client_email
                }));
            }
        },

        async handleBookingSubmit(e) {
            e.preventDefault();
            const formData = new FormData(e.target);

            if (!formData.get('time')) {
                this.showNotification('Por favor selecciona un horario.');
                return;
            }

            const serviceId = parseInt(formData.get('service'));
            const professionalId = parseInt(formData.get('professional'));
            const date = formData.get('date');
            const time = formData.get('time').trim();
            const clientName = formData.get('name');
            const clientEmail = formData.get('email');

            // Prepare object for Supabase
            const newBooking = {
                date,
                time,
                service_id: serviceId,
                professional_id: professionalId,
                client_id: state.currentUser ? state.currentUser.id : null,
                patient_name: clientName,
                client_email: clientEmail,
                status: 'confirmed'
            };

            const { data, error } = await supabase.from('bookings').insert([newBooking]).select();

            if (error) {
                alert('Error al reservar: ' + error.message);
                return;
            }

            this.showNotification('Turno reservado con éxito!');

            await this.fetchBookings();

            // Match existing confirmation logic
            // We construct a purely local object for the modal display
            const displayBooking = {
                ...newBooking,
                serviceName: state.services.find(s => s.id === serviceId).name,
                professionalName: state.professionals.find(p => p.id === professionalId).name
            };
            this.showEmailModal(displayBooking);

            if (state.currentUser) {
                // Optional: navigate away or stay
                this.navigate('my-bookings');
            }
        },

        showEmailModal(booking) {
            const content = `
            <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid #eee;">
                <button onclick="turnoApp.switchChannel('email')" id="btn-email" class="tab-btn active" style="padding-bottom: 0.5rem;">Email</button>
                <button onclick="turnoApp.switchChannel('whatsapp')" id="btn-whatsapp" class="tab-btn" style="padding-bottom: 0.5rem;">WhatsApp</button>
                <button onclick="turnoApp.switchChannel('sms')" id="btn-sms" class="tab-btn" style="padding-bottom: 0.5rem;">SMS</button>
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
                <button onclick="turnoApp.showNotification('SMS enviado (simulado)')" class="btn-primary" style="width: 100%; background: #4b5563; border-color: #4b5563;">Simular Envío SMS</button>
            </div>

            <button onclick="turnoApp.closeModal(); turnoApp.navigate('home')" class="btn-secondary" style="width: 100%; margin-top: 1rem;">Cerrar</button>
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
                    
                    <div class="mb-4" style="display: flex; gap: 1rem; max-width: 600px; margin: 0 auto 1.5rem;">
                        <input type="text" placeholder="Buscar por nombre, email o teléfono..." class="form-input" style="flex: 1;" onkeyup="turnoApp.filterPatients(this.value)">
                        ${user.role === 'professional' || user.role === 'admin' ?
                    `<button onclick="turnoApp.showCreatePatientModal()" class="btn-primary" style="white-space: nowrap;">+ Nuevo Paciente</button>`
                    : ''}
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
                                            <button onclick="turnoApp.navigate('patient-profile', '${p.email}')" style="background: var(--primary); color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer;">Ver Perfil</button>
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
                    <button onclick="turnoApp.navigate('patient-profile', '${p.email}')" style="background: var(--primary); color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer;">Ver Perfil</button>
                </td>
            </tr>
        `).join('');
        },

        showCreatePatientModal() {
            this.openModal(`
            <div style="text-align: left;">
                <h3 style="margin-bottom: 1.5rem;">Registrar Nuevo Paciente</h3>
                <form onsubmit="turnoApp.createPatient(event, this)">
                    <div class="form-group">
                        <label class="form-label">Nombre Completo</label>
                        <input type="text" name="name" class="form-input" required placeholder="Juan Pérez">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" name="email" class="form-input" required placeholder="juan@ejemplo.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Teléfono</label>
                        <input type="tel" name="phone" class="form-input" required placeholder="11 1234 5678">
                    </div>
                    <div style="margin-top: 1.5rem; text-align: right;">
                        <button type="button" onclick="turnoApp.closeModal()" class="btn-secondary" style="margin-right: 0.5rem;">Cancelar</button>
                        <button type="submit" class="btn-primary">Crear Paciente</button>
                    </div>
                </form>
            </div>
        `);
        },

        createPatient(e, form) {
            e.preventDefault();
            const name = form.name.value;
            const email = form.email.value;
            const phone = form.phone.value;

            if (state.users.find(u => u.email === email)) {
                alert('Este email ya está registrado en el sistema.');
                return;
            }

            // 1. Create User
            const newUser = {
                email,
                password: '123', // Default placeholder
                name,
                role: 'patient'
            };
            state.users.push(newUser);
            // Persist users if we were using LS for them, but usually syncing happens via patients/visits. 
            // For this demo, we'll assume state.users is enough or updated via app flow.
            // Actually, let's sync users to LS for consistency in this demo app
            // localStorage.setItem('lumina_users', JSON.stringify(state.users)); // Not strictly used by turnoApp.init but good for completeness

            // 2. Create Patient Record
            const newPatient = {
                name,
                email,
                phone,
                lastVisit: '-',
                totalVisits: 0
            };
            state.patients.push(newPatient);
            localStorage.setItem('lumina_patients', JSON.stringify(state.patients));

            this.closeModal();
            this.showNotification('Paciente creado correctamente');
            this.renderPatients(); // Refresh list
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
                <div class="container">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <button onclick="turnoApp.navigate('patients')" class="btn-secondary">← Volver al Listado</button>
                        ${(user.role === 'professional' || user.role === 'admin') ?
                    `<button onclick="turnoApp.startBooking(null, null, '${p.email}')" class="btn-primary">Agendar Turno</button>`
                    : ''}
                    </div>
                    
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
                                <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">Email</label>
                                <div style="display: flex; gap: 0.5rem;">
                                    <input type="email" value="${p.email}" id="edit-email" class="form-input" style="padding: 0.5rem;">
                                </div>
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">Teléfono</label>
                                <div style="display: flex; gap: 0.5rem;">
                                    <input type="text" value="${p.phone || ''}" id="edit-phone" class="form-input" style="padding: 0.5rem;">
                                </div>
                            </div>
                            <button onclick="turnoApp.savePatientProfile('${p.id}')" class="btn-primary" style="width: 100%; margin-top: 1rem;">Guardar Cambios</button>
                            
                            <div style="margin-top: 2rem;">
                                <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">Visitas Totales</label>
                                <p>${p.totalVisits || 0}</p>
                            </div>
                            <div>
                                <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">Última Visita</label>
                                <p>${p.lastVisit || '-'}</p>
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

                             <!-- Visit History (Financial) -->
                             <h3 style="margin: 2rem 0 1rem;">Historial de Visitas (Detalle)</h3>
                             ${(() => {
                    const bookingIds = new Set(pBookings.map(b => b.id));
                    const pVisits = state.visits.filter(v => bookingIds.has(v.bookingId));

                    if (!pVisits.length) return '<p style="color: #666;">No hay visitas registradas.</p>';

                    return `
                                    <div style="overflow-x: auto;">
                                        <table class="admin-table" style="font-size: 0.9rem;">
                                            <thead>
                                                <tr>
                                                    <th>Fecha</th>
                                                    <th>Tratamiento</th>
                                                    <th>Profesional</th>
                                                    <th>Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${pVisits.sort((a, b) => new Date(b.date) - new Date(a.date)).map(v => {
                        const prof = state.professionals.find(p => p.id === parseInt(v.professionalId));
                        return `
                                                        <tr>
                                                            <td>${v.date}</td>
                                                            <td>${v.treatment || 'Servicio'}</td>
                                                            <td>${prof ? prof.name : 'Desconocido'}</td>
                                                            <td style="font-weight: bold;">$${v.price}</td>
                                                        </tr>
                                                     `;
                    }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `;
                })()}
                        </div>
                    </div>
                </div>
            </section>
        `;
            this.updateIcons();
        },

        async savePatientProfile(id) {
            const phone = document.getElementById('edit-phone').value;
            const email = document.getElementById('edit-email').value;

            const { error } = await supabase
                .from('profiles')
                .update({ phone: phone, email: email })
                .eq('id', id);

            if (error) {
                this.showNotification('Error al actualizar: ' + error.message);
            } else {
                this.showNotification('Perfil actualizado correctamente');
                // Refresh local data logic if needed, or re-fetch
                const p = state.patients.find(pt => pt.id === id);
                if (p) { p.phone = phone; p.email = email; }
            }
        },


        // ENH-24: Module Visits
        registerVisit(bookingId) {
            const booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;

            const content = `
            <h3 class="mb-4">Registrar Visita</h3>
            <p style="color: #666; margin-bottom: 1rem;">${booking.serviceName} - ${booking.clientName}</p>
            <form onsubmit="turnoApp.saveVisit(event, ${bookingId})">
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
        // ENH-25: Reports
        renderReports() {
            // Only Admin
            if (state.currentUser.role !== 'admin') return;

            const main = document.getElementById('main-content');

            // Filter Logic
            const { startDate, endDate, professionalId } = state.reportFilters;

            let filteredVisits = state.visits;

            if (startDate) {
                filteredVisits = filteredVisits.filter(v => v.date >= startDate);
            }
            if (endDate) {
                filteredVisits = filteredVisits.filter(v => v.date <= endDate);
            }
            if (professionalId) {
                filteredVisits = filteredVisits.filter(v => v.professionalId == professionalId);
            }

            // Calculate Totals by Professional
            const reportData = {};

            filteredVisits.forEach(v => {
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
                    
                    <button onclick="turnoApp.navigate('admin')" class="btn-secondary" style="margin-bottom: 2rem;">← Volver a Reservas</button>

                     <!-- Filters -->
                    <div class="filters-bar" style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 2rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;">
                        <div style="flex: 1; min-width: 200px;">
                            <label class="form-label" style="font-size: 0.85rem;">Desde</label>
                            <input type="date" class="form-input" value="${startDate}" onchange="state.reportFilters.startDate = this.value; turnoApp.renderReports()">
                        </div>
                        <div style="flex: 1; min-width: 200px;">
                            <label class="form-label" style="font-size: 0.85rem;">Hasta</label>
                            <input type="date" class="form-input" value="${endDate}" onchange="state.reportFilters.endDate = this.value; turnoApp.renderReports()">
                        </div>
                        <div style="flex: 1; min-width: 200px;">
                            <label class="form-label" style="font-size: 0.85rem;">Profesional</label>
                            <select class="form-select" onchange="state.reportFilters.professionalId = this.value; turnoApp.renderReports()">
                                <option value="">Todos</option>
                                ${state.professionals.map(p => `<option value="${p.id}" ${p.id == professionalId ? 'selected' : ''}>${p.name}</option>`).join('')}
                            </select>
                        </div>
                        <button onclick="state.reportFilters = { startDate: '', endDate: '', professionalId: '' }; turnoApp.renderReports()" class="btn-secondary" style="height: 42px;">
                            Limpiar Filtros
                        </button>
                    </div>

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
                                ${Object.keys(reportData).length === 0 ? '<tr><td colspan="5" class="text-center">No hay visitas que coincidan con los filtros.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>

                    <div class="section-header" style="margin-top: 3rem;">
                        <h3>Detalle de Movimientos</h3>
                        <p>Desglose de visitas realizadas</p>
                    </div>

                    <div style="overflow-x: auto;">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Paciente</th>
                                    <th>Profesional</th>
                                    <th>Tratamiento</th>
                                    <th>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredVisits.sort((a, b) => new Date(b.date) - new Date(a.date)).map(v => {
                const booking = state.bookings.find(b => b.id === v.bookingId);
                const prof = state.professionals.find(p => p.id === parseInt(v.professionalId));
                return `
                                    <tr>
                                        <td>${v.date}</td>
                                        <td>${booking ? booking.clientName : 'Cliente Externo'}</td>
                                        <td>${prof ? prof.name : 'Desconocido'}</td>
                                        <td>${v.treatment || 'Servicio'}</td>
                                        <td style="font-weight: bold;">$${v.price}</td>
                                    </tr>
                                    `;
            }).join('')}
                                ${filteredVisits.length === 0 ? '<tr><td colspan="5" class="text-center">No hay movimientos.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        `;
        },



        applyAdminFilters() {
            state.adminFilters.professionalId = document.getElementById('filter-prof').value;
            state.adminFilters.status = document.getElementById('filter-status').value;
            // Month filter applies to List view mainly, but could sync with Calendar
            if (document.getElementById('filter-month')) {
                state.adminFilters.month = document.getElementById('filter-month').value;
            }
            this.renderAdmin();
        },

        // Toggle Admin View Mode
        setAdminViewMode(mode) {
            state.agendaView.mode = mode;
            this.renderAdmin();
        },

        changeCalendarMonth(delta) {
            state.agendaView.calendarMonth += delta;
            if (state.agendaView.calendarMonth > 11) {
                state.agendaView.calendarMonth = 0;
                state.agendaView.calendarYear++;
            } else if (state.agendaView.calendarMonth < 0) {
                state.agendaView.calendarMonth = 11;
                state.agendaView.calendarYear--;
            }
            this.renderAdmin();
        },

        renderAdmin() {
            const main = document.getElementById('main-content');
            const isCalendar = state.agendaView.mode === 'calendar';

            main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2>Panel de Administración</h2>
                        <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                             <div class="view-toggle">
                                <button onclick="turnoApp.setAdminViewMode('list')" class="${!isCalendar ? 'active' : ''}">Lista</button>
                                <button onclick="turnoApp.setAdminViewMode('calendar')" class="${isCalendar ? 'active' : ''}">Calendario</button>
                             </div>
                             <button onclick="turnoApp.navigate('reports')" class="btn-secondary">Reportes Financieros</button>
                             <button onclick="turnoApp.navigate('patients')" class="btn-secondary">Maestro Pacientes</button>
                        </div>
                    </div>

                    ${isCalendar ? this.getAdminCalendarHTML() : this.getAdminListHTML()}
                </div>
            </section>
        `;

            if (!isCalendar) {
                // Re-attach values for list filters (simulated persistence)
                if (document.getElementById('filter-prof')) document.getElementById('filter-prof').value = state.adminFilters.professionalId;
                if (document.getElementById('filter-status')) document.getElementById('filter-status').value = state.adminFilters.status;
                if (document.getElementById('filter-month')) document.getElementById('filter-month').value = state.adminFilters.month;
            }
        },

        getAdminListHTML() {
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

            return `
            <!-- Filters Toolbar -->
            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: end; border: 1px solid #e2e8f0;">
                <div style="flex: 1; min-width: 200px;">
                    <label style="display: block; font-size: 0.8rem; margin-bottom: 0.25rem; font-weight: 600; color: #64748b;">Profesional</label>
                    <select id="filter-prof" class="form-select" style="margin:0;" onchange="turnoApp.applyAdminFilters()">
                        <option value="">Todos</option>
                        ${state.professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
                 <div style="flex: 1; min-width: 150px;">
                    <label style="display: block; font-size: 0.8rem; margin-bottom: 0.25rem; font-weight: 600; color: #64748b;">Estado</label>
                    <select id="filter-status" class="form-select" style="margin:0;" onchange="turnoApp.applyAdminFilters()">
                        <option value="">Todos</option>
                        <option value="Confirmado">Confirmado</option>
                        <option value="Completado">Completado</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <label style="display: block; font-size: 0.8rem; margin-bottom: 0.25rem; font-weight: 600; color: #64748b;">Mes</label>
                    <input type="month" id="filter-month" class="form-input" style="margin:0;" value="${state.adminFilters.month}" onchange="turnoApp.applyAdminFilters()">
                </div>
                <div style="display: flex; align-items: end;">
                    <button onclick="state.adminFilters={professionalId:'',status:'',month:''}; turnoApp.renderAdmin()" style="padding: 0.5rem 1rem; border: none; background: transparent; color: #666; cursor: pointer; text-decoration: underline;">Limpiar</button>
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
                                    <button onclick="turnoApp.editBooking(${b.id})" style="background: none; border: 1px solid #ddd; padding: 4px 8px; cursor: pointer; border-radius: 4px;">Editar</button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="7" class="text-center">No hay reservas con estos filtros.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        },

        getAdminCalendarHTML() {
            const year = state.agendaView.calendarYear;
            const month = state.agendaView.calendarMonth;

            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

            // Calendar Logic
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startDayOfWeek = firstDay.getDay(); // 0 = Sun

            // Bookings for this month
            const monthPrefix = `${year}-${(month + 1).toString().padStart(2, '0')}`;
            const monthBookings = state.bookings.filter(b => b.date.startsWith(monthPrefix) && b.status !== 'Cancelado');

            let calendarGrid = '';

            // Empty cells for days before start
            for (let i = 0; i < startDayOfWeek; i++) {
                calendarGrid += `<div class="calendar-day empty"></div>`;
            }

            // Days
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                const dayBookings = monthBookings.filter(b => b.date === dateStr);
                const isToday = new Date().toISOString().split('T')[0] === dateStr;

                calendarGrid += `
                <div class="calendar-day ${isToday ? 'today' : ''}" onclick="turnoApp.showDayDetails('${dateStr}')">
                    <div class="day-number">${d}</div>
                    ${dayBookings.length > 0 ? `
                        <div class="day-indicators">
                            ${dayBookings.slice(0, 3).map(b => `<span class="dot" title="${b.time} - ${b.serviceName}"></span>`).join('')}
                            ${dayBookings.length > 3 ? '<span class="dot plus">+</span>' : ''}
                        </div>
                        <div class="day-count">${dayBookings.length} turnos</div>
                    ` : ''}
                </div>
            `;
            }

            return `
            <div class="calendar-container">
                <div class="calendar-header">
                    <button onclick="turnoApp.changeCalendarMonth(-1)" class="btn-icon">←</button>
                    <h3>${monthNames[month]} ${year}</h3>
                    <button onclick="turnoApp.changeCalendarMonth(1)" class="btn-icon">→</button>
                </div>
                <div class="calendar-weekdays">
                    <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
                </div>
                <div class="calendar-grid">
                    ${calendarGrid}
                </div>
            </div>
        `;
        },

        showDayDetails(dateStr) {
            const bookings = state.bookings.filter(b => b.date === dateStr);
            if (bookings.length === 0) return;

            const content = `
            <h3>Turnos del ${dateStr}</h3>
            <div style="margin-top: 1rem; max-height: 400px; overflow-y: auto;">
                ${bookings.map(b => `
                    <div style="padding: 0.75rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${b.time}</strong> - ${b.clientName}<br>
                            <span style="font-size: 0.9rem; color: #666;">${b.serviceName} con ${b.professionalName}</span>
                        </div>
                        <span class="status-badge ${b.status.toLowerCase()}" style="font-size: 0.75rem;">${b.status}</span>
                    </div>
                `).join('')}
            </div>
             <div style="margin-top: 1rem; text-align: right;">
                <button onclick="turnoApp.closeModal()" class="btn-secondary">Cerrar</button>
            </div>
        `;
            this.openModal(content);
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
                        <form onsubmit="event.preventDefault(); turnoApp.login(this.email.value, this.password.value)">
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
                                <a href="#" onclick="event.preventDefault(); turnoApp.forgotPassword()" style="color: var(--primary); font-size: 0.9rem;">¿Olvidaste tu contraseña?</a>
                            </div>
                        </form>
                        <div class="auth-btn-group">
                            <button onclick="turnoApp.login('admin@julielle.com', 'admin')" style="background:none; border:none; color: #999; cursor: pointer; text-decoration: underline;">Demo Admin</button>
                            <button onclick="turnoApp.login('paciente@test.com', '123')" style="background:none; border:none; color: #999; cursor: pointer; text-decoration: underline;">Demo Paciente</button>
                            <button onclick="turnoApp.login('profesional@julielle.com', 'prof')" style="background:none; border:none; color: #999; cursor: pointer; text-decoration: underline;">Demo Prof</button>
                        </div>
                         <div style="margin-top: 2rem; border-top: 1px solid #eee; padding-top: 1rem;">
                            <p>¿Nunca te registraste?</p>
                            <button onclick="turnoApp.navigate('register')" class="btn-secondary" style="margin-top: 0.5rem; width: 100%;">Creá tu usuario</button>
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
                        <form onsubmit="event.preventDefault(); turnoApp.register(this)">
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
                            <button onclick="turnoApp.navigate('login')" class="btn-secondary" style="margin-top: 0.5rem; width: 100%;">Iniciar Sesión</button>
                        </div>
                    </div>
                </div>
            </section>
        `;
        },

        async register(form) {
            const name = form.name.value;
            const email = form.email.value;
            const password = form.password.value;

            // 1. Sign Up
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                alert('Error al registrarse: ' + error.message);
                return;
            }

            // 2. Create Profile
            if (data.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        { id: data.user.id, email, name, role: 'patient', phone: '' }
                    ]);

                if (profileError) {
                    console.error("Profile creation failed:", profileError);
                    // Fallback?
                }

                this.showNotification('Cuenta creada con éxito. Iniciando sesión...');
                // Auto login usually happens on SignUp if confirm not required, checking session inside login not needed if we trust signUp session
                // But let's call our standardize login flow to set state
                await this.login(email, password);
            }
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
    <section class="section">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">${title}</h2>
                <p>${subtitle}</p>
            </div>
            
            <div style="max-width: 900px; margin: 0 auto;">
                ${myBookings.length ? myBookings.map(b => {
                const isProfessional = state.currentUser.role === 'professional';
                const personLabel = isProfessional ? b.clientName : b.professionalName;
                const status = b.status || 'pending'; // Default safe
                const statusClass = status.toLowerCase().replace(/\s/g, '-');

                // Button Logic
                let actions = '';
                if (isProfessional) {
                    if (status === 'confirmed' || status === 'Confirmado') {
                        actions = `
                                <button onclick="turnoApp.registerVisit(${b.id})" class="btn-primary" style="font-size: 0.85rem; padding: 0.5rem;">✅ Completar</button>
                                <button onclick="turnoApp.rescheduleBooking(${b.id})" class="btn-secondary" style="font-size: 0.85rem; padding: 0.5rem;">📅 Reagendar</button>
                            `;
                    } else if (status === 'completed' || status === 'Completado') {
                        actions = `<span class="text-center" style="color: var(--primary); font-size: 0.9rem;">✨ Visita Registrada</span>`;
                    }
                } else {
                    // Patient View Actions
                    if (status === 'confirmed' || status === 'Confirmado') {
                        actions = `<button onclick="alert('Contacta al centro para cancelar.')" class="btn-secondary" style="font-size: 0.8rem; padding: 0.4rem;">Cancelar/Cambiar</button>`;
                    }
                }

                return `
                    <div class="appointment-card status-${statusClass}">
                        <div class="time-column">
                            <span class="time-hour">${b.time}</span>
                            <span class="time-date">${b.date}</span>
                        </div>
                        
                        <div class="info-column">
                            <span class="status-badge ${statusClass}">${status}</span>
                            <h3>${b.serviceName}</h3>
                            <div class="info-meta">
                                <span class="info-item">
                                    <i data-lucide="user" width="16"></i> ${personLabel}
                                </span>
                                ${isProfessional ? `
                                <span class="info-item">
                                    <i data-lucide="mail" width="16"></i> ${b.clientEmail}
                                </span>` : ''}
                            </div>
                        </div>

                        <div class="actions-column">
                            ${actions}
                        </div>
                    </div>
                    `;
            }).join('') : `
                    <div class="text-center" style="padding: 4rem; background: #f9f9f9; border-radius: 8px;">
                        <i data-lucide="calendar-x" width="48" height="48" style="color: #ccc; margin-bottom: 1rem;"></i>
                        <p style="color: #666;">No tienes turnos agendados.</p>
                        <button onclick="turnoApp.navigate('services')" class="btn-primary" style="margin-top: 1rem;">Agendar Nuevo</button>
                    </div>
                `}
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
                    <button onclick="turnoApp.closeModal()" style="padding: 0.5rem 1rem; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">Cancelar</button>
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
            <form onsubmit="turnoApp.updateBooking(event, ${id})">
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
                <button type="button" onclick="turnoApp.closeModal()" style="flex: 1; padding: 0.75rem; border: 1px solid #ddd; background: white; border-radius: 50px; cursor: pointer;">Cancelar</button>
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
    document.addEventListener('DOMContentLoaded', () => turnoApp.init());

    // Expose to window for HTML onclick handlers
    window.turnoApp = turnoApp;
})();
