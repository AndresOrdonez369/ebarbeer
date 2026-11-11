// create-staff · the only server code outside Postgres.
// Lets an admin give, change or remove a login for a barber or cashier without ever exposing
// the service-role key to the browser.
//
// POST { action: 'grant', staff_id, username, password }   give an existing staff member a login
// POST { action: 'password', staff_id, password }          change a login's password / PIN
// POST { action: 'revoke', staff_id }                       remove the login (history is kept)
//
// Staff log in with "username + PIN". Supabase Auth needs an email, so each login gets a
// synthetic address that never receives mail: <username>.<shop-slug>@<STAFF_EMAIL_DOMAIN>.
// The web app builds the same address from what the person types.

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const USERNAME = /^[a-z0-9._-]{2,30}$/;
const DOMAIN = Deno.env.get('STAFF_EMAIL_DOMAIN') ?? 'staff.barbeer.app';

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
	if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });

	const url = Deno.env.get('SUPABASE_URL')!;
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
	const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
	const authHeader = req.headers.get('Authorization') ?? '';

	// 1. Who is asking? Use their own token so row level security answers.
	const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
	const [{ data: role }, { data: shopId }] = await Promise.all([
		asCaller.rpc('my_role'),
		asCaller.rpc('my_shop_id')
	]);
	if (role !== 'admin' || !shopId) return json(403, { error: 'Solo un administrador puede gestionar accesos' });

	let body: { action?: string; staff_id?: string; username?: string; password?: string };
	try {
		body = await req.json();
	} catch {
		return json(400, { error: 'Solicitud no válida' });
	}

	const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

	// 2. The target must belong to the caller's shop.
	const { data: staff } = await admin
		.from('staff')
		.select('id, shop_id, user_id, role, username, shops(slug)')
		.eq('id', body.staff_id ?? '')
		.eq('shop_id', shopId)
		.maybeSingle();
	if (!staff) return json(404, { error: 'Persona no encontrada en este local' });

	const password = body.password ?? '';
	const passwordOk = password.length >= 6 && password.length <= 72;

	if (body.action === 'grant') {
		const username = (body.username ?? '').trim().toLowerCase();
		if (!USERNAME.test(username)) return json(400, { error: 'Usuario: 2 a 30 letras minúsculas, números, punto o guion' });
		if (!passwordOk) return json(400, { error: 'El PIN o la contraseña debe tener al menos 6 caracteres' });
		if (staff.user_id) return json(409, { error: 'Esta persona ya tiene acceso' });

		const slug = (staff.shops as unknown as { slug: string }).slug;
		const { data: created, error } = await admin.auth.admin.createUser({
			email: `${username}.${slug}@${DOMAIN}`,
			password,
			email_confirm: true,
			app_metadata: { shop_id: shopId, staff_id: staff.id }
		});
		if (error || !created.user) return json(400, { error: error?.message ?? 'No se pudo crear el acceso' });

		const { error: linkError } = await admin
			.from('staff')
			.update({ user_id: created.user.id, username })
			.eq('id', staff.id);
		if (linkError) {
			await admin.auth.admin.deleteUser(created.user.id);
			return json(400, { error: linkError.message });
		}
		return json(200, { ok: true });
	}

	if (body.action === 'password') {
		if (!staff.user_id) return json(409, { error: 'Esta persona no tiene acceso' });
		if (!passwordOk) return json(400, { error: 'El PIN o la contraseña debe tener al menos 6 caracteres' });
		const { error } = await admin.auth.admin.updateUserById(staff.user_id, { password });
		if (error) return json(400, { error: error.message });
		return json(200, { ok: true });
	}

	if (body.action === 'revoke') {
		if (!staff.user_id) return json(200, { ok: true });
		const { data: caller } = await asCaller.auth.getUser();
		if (caller.user && caller.user.id === staff.user_id)
			return json(400, { error: 'No puedes quitarte tu propio acceso. Pídeselo a otro administrador.' });
		// Deleting the auth user nulls staff.user_id; the database refuses if it is the last admin.
		const { error } = await admin.auth.admin.deleteUser(staff.user_id);
		if (error) return json(400, { error: error.message });
		return json(200, { ok: true });
	}

	return json(400, { error: 'Acción no válida' });
});
