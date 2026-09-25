import jwt from 'jsonwebtoken';

// Verifies the JWT on the Authorization header and attaches { userId, email, role } to req.user
export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Use after requireAuth — only NavaSetu platform admins may proceed
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'platform_admin') {
    return res.status(403).json({ error: 'NavaSetu admin access required' });
  }
  next();
}

// Use after requireAuth — platform admins (full visibility) OR counsellors
// (their assigned leads only). Routes using this must apply their own
// per-record scoping for counsellors — this middleware only gates entry.
export function requireStaff(req, res, next) {
  if (!req.user || !['platform_admin', 'counsellor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Staff access required' });
  }
  next();
}

// Like requireAuth but does not fail the request if there's no/invalid token —
// useful for the public assessment flow where login is optional until submit.
export function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    }
  } catch (error) {
    // ignore invalid token in optional mode
  }
  next();
}
