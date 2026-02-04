
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mmoaptsmulsuvdtepiot.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tb2FwdHNtdWxzdXZkdGVwaW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDgwNTgsImV4cCI6MjA4NDk4NDA1OH0.yvk_xOmDQFLgqNmvjJUd9Cnwvvm90Bnd26MrlyJj6bU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function restoreUsers() {
    console.log("Iniciando restauración de usuarios desde la terminal...");

    const users = [
        { email: 'admin@lumina.com', password: 'lumina2024', role: 'admin', name: 'Administrador Demo', phone: '1111-1111' },
        { email: 'profesional@lumina.com', password: 'lumina2024', role: 'professional', name: 'Dra. Morcilla', phone: '2222-2222', professionalLinkName: 'Dra. Morcilla' },
        { email: 'paciente@lumina.com', password: 'lumina2024', role: 'patient', name: 'Paciente Demo', phone: '3333-3333' }
    ];

    for (const u of users) {
        console.log(`\nProcesando usuario: ${u.email}`);

        // 1. SignUp / Login
        let userId = null;
        let { data, error } = await supabase.auth.signUp({
            email: u.email,
            password: u.password,
            options: { data: { name: u.name, role: u.role } }
        });

        if (error) {
            // Already registered?
            if (error.message.includes("already registered") || error.status === 400 || error.status === 422) {
                console.log("  -> Usuario ya existe. Intentando login...");
                const loginComp = await supabase.auth.signInWithPassword({
                    email: u.email,
                    password: u.password
                });

                if (loginComp.error) {
                    console.error(`  -> ERROR LOGIN: ${loginComp.error.message}`);
                    continue;
                }
                userId = loginComp.data.user.id;
                console.log(`  -> Login Exitoso. ID: ${userId}`);
            } else {
                console.error(`  -> ERROR SIGNUP: ${error.message}`);
                continue;
            }
        } else if (data.user) {
            // Check identity for false positive on signup
            if (data.user.identities && data.user.identities.length === 0) {
                console.log("  -> Usuario ya existe (Identity check). Intentando login...");
                const loginComp = await supabase.auth.signInWithPassword({ email: u.email, password: u.password });
                if (loginComp.error) {
                    console.error(`  -> ERROR LOGIN: ${loginComp.error.message}`);
                    continue;
                }
                userId = loginComp.data.user.id;
            } else {
                userId = data.user.id;
                console.log(`  -> Usuario Creado. ID: ${userId}`);
            }
        }

        if (!userId) continue;

        // 2. Profile
        const { error: profErr } = await supabase.from('profiles').upsert({
            id: userId, email: u.email, name: u.name, role: u.role, phone: u.phone
        });
        if (profErr) console.error(`  -> Error Perfil: ${profErr.message}`);
        else console.log(`  -> Perfil actualizado.`);

        // 3. Professional Link
        if (u.role === 'professional') {
            const { data: profData } = await supabase.from('professionals').select('id').eq('name', u.professionalLinkName).single();
            if (profData) {
                await supabase.from('professionals').update({ user_id: userId }).eq('id', profData.id);
                console.log(`  -> Profesional vinculado a tabla 'professionals'.`);
            } else {
                console.warn(`  -> No se encontró profesional '${u.professionalLinkName}' en la BD.`);
            }
        }
    }
    console.log("\n---------------------------------------------------");
    console.log("PROCESO TERMINADO. Intenta loguearte en la web ahora.");
}

restoreUsers();
