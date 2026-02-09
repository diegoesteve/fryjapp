
getAdminWeekHTML() {
    const currentDate = state.agendaView.selectedDay ? new Date(state.agendaView.selectedDay) : new Date();
    const dayOfWeek = currentDate.getDay(); // 0 (Sun) - 6 (Sat)
    const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
    const startOfWeek = new Date(currentDate.setDate(diff));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startStr = startOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const endStr = endOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

    let weekGrid = `<div class="week-view-container" style="display: flex; gap: 10px; overflow-x: auto;">`;

    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + i);
        const dateStr = dayDate.toISOString().split('T')[0];
        const dayName = dayDate.toLocaleDateString('es-ES', { weekday: 'short' });
        const dayNum = dayDate.getDate();
        const isToday = new Date().toISOString().split('T')[0] === dateStr;
        const isSelected = state.agendaView.selectedDay && new Date(state.agendaView.selectedDay).toISOString().split('T')[0] === dateStr;

        const dayBookings = state.bookings.filter(b => b.date === dateStr && b.status !== 'Cancelado');

        weekGrid += `
                <div class="week-day-column ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
                     onclick="turnoApp.showDayDetails('${dateStr}')" 
                     style="flex: 1; min-width: 120px; border: 1px solid #eee; border-radius: 8px; padding: 10px; background: ${isToday ? '#f0f9ff' : 'white'}; cursor: pointer;">
                    <div style="font-weight: bold; text-align: center; margin-bottom: 5px; color: #555;">${dayName} ${dayNum}</div>
                    <div class="day-bookings-list" style="font-size: 0.8rem;">
                        ${dayBookings.length > 0 ? dayBookings.map(b => `
                            <div style="background: ${this.getServiceColor(b.serviceId)}; color: white; padding: 2px 4px; border-radius: 4px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${b.time} ${b.clientName.split(' ')[0]}
                            </div>
                        `).join('') : '<div style="color: #ccc; text-align: center;">-</div>'}
                    </div>
                </div>`;
    }
    weekGrid += `</div>`;

    return `
            <div class="calendar-container">
                <div class="calendar-header">
                     <button onclick="turnoApp.changeWeek(-1)" class="btn-icon">← </button>
                     <h3>Semana ${startStr} - ${endStr}</h3>
                     <button onclick="turnoApp.changeWeek(1)" class="btn-icon">→ </button>
                </div>
                ${weekGrid}
            </div>`;
},

changeWeek(direction) {
    const current = new Date(state.agendaView.selectedDay || new Date());
    current.setDate(current.getDate() + (direction * 7));
    state.agendaView.selectedDay = current;
    state.agendaView.calendarMonth = current.getMonth();
    state.agendaView.calendarYear = current.getFullYear();
    this.renderAdmin();
},

getAdminDayHTML() {
    const dateStr = state.agendaView.selectedDay ? new Date(state.agendaView.selectedDay).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const dateObj = new Date(dateStr + 'T12:00:00'); // Safe date parsing
    const prettyDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const dayBookings = state.bookings
        .filter(b => b.date === dateStr && b.status !== 'Cancelado')
        .sort((a, b) => a.time.localeCompare(b.time));

    // Grid 8am - 8pm
    const hours = [];
    for (let h = 8; h <= 20; h++) {
        hours.push(`${h.toString().padStart(2, '0')}:00`);
    }

    let dayGrid = `<div class="day-view-container" style="display: flex; flex-direction: column; gap: 5px;">`;

    // Simple list for now, timeline view is complex
    if (dayBookings.length === 0) {
        dayGrid += `<div style="padding: 2rem; text-align: center; color: #666;">No hay turnos para este día.</div>`;
    } else {
        dayGrid += dayBookings.map(b => `
                    <div style="display: flex; gap: 1rem; padding: 10px; border: 1px solid #eee; border-radius: 8px; align-items: center; background: white;">
                        <div style="font-weight: bold; width: 60px; color: var(--primary);">${b.time}</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">${b.serviceName} (${b.duration} min)</div>
                            <div style="font-size: 0.9rem; color: #555;">${b.clientName}</div>
                            <div style="font-size: 0.8rem; color: #888;">${b.professionalName}</div>
                        </div>
                        <div>
                             <span class="status-badge ${b.status === 'Confirmado' ? 'confirmado' : 'pendiente'}">${b.status}</span>
                        </div>
                        <div>
                             <button onclick="turnoApp.openBookingDetails(${b.id})" class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;">Ver</button>
                        </div>
                    </div>
                 `).join('');
    }
    dayGrid += `</div>`;

    return `
            <div class="calendar-container">
                <div class="calendar-header">
                     <button onclick="turnoApp.changeDay(-1)" class="btn-icon">← </button>
                     <h3>${prettyDate}</h3>
                     <button onclick="turnoApp.changeDay(1)" class="btn-icon">→ </button>
                </div>
                ${dayGrid}
            </div>`;
},

changeDay(direction) {
    const current = new Date(state.agendaView.selectedDay || new Date());
    current.setDate(current.getDate() + direction);
    state.agendaView.selectedDay = current;
    state.agendaView.calendarMonth = current.getMonth();
    state.agendaView.calendarYear = current.getFullYear();
    this.renderAdmin();
},

getServiceColor(serviceId) {
    // Helper to color code bookings by service
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[serviceId % colors.length] || '#64748b';
},
