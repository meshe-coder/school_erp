const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const cors = require('cors');
const passport = require('./config/passport');
const env = require('./config/env');
const { pool } = require('./config/db');
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const academicRoutes = require('./modules/academic/academic.routes');
const classesRoutes = require('./modules/classes/classes.routes');
const studentsRoutes = require('./modules/students/students.routes');
const feesRoutes = require('./modules/fees/fees.routes');
const billingRoutes = require('./modules/billing/billing.routes');
const billingStudentRoutes = require('./modules/billing/billingStudent.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const path = require('path');
const { blockUntilPasswordChanged } = require('./middleware/auth');
const { requireApiHeader } = require('./middleware/csrf');

const app = express();

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/')) {
    const knownApiPrefixes = ['/api/auth', '/api/admin', '/api/academic', '/api/student', '/api/config'];
    const known = knownApiPrefixes.some((prefix) => req.originalUrl.startsWith(prefix));
    if (!known) return res.status(404).json({ error: 'Not found' });
  }
  return next();
});

if (env.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

const helmetOptions = env.nodeEnv === 'production'
  ? {}
  : { contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } } };

app.use(helmet(helmetOptions));
app.use(cors({
  origin: env.corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));

app.use(session({
  name: 'sid',
  store: new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
  }),
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  },
  rolling: true,
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(requireApiHeader);

app.get('/api/config', (req, res) => {
  res.status(200).json({
    schoolName: env.schoolName,
    paymentInstructions: env.paymentInstructions,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin/users', usersRoutes);
app.use('/api', academicRoutes);
app.use('/api', classesRoutes);
app.use('/api', studentsRoutes);
app.use('/api', feesRoutes);
app.use('/api', billingRoutes);
app.use('/api', billingStudentRoutes);
app.use('/api', (req, res, next) => {
  const knownPrefixes = ['/api/auth', '/api/admin', '/api/academic', '/api/student'];
  const isKnown = knownPrefixes.some((prefix) => req.originalUrl.startsWith(prefix));

  if (!isKnown) {
    return res.status(404).json({ error: 'Not found' });
  }

  return next();
});
app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return notFound(req, res);
  }

  return res.status(404).type('text/plain').send('404 - Page not found');
});

app.use(errorHandler);

module.exports = app;
