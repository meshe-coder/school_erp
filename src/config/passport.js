const passport = require('passport');
const LocalStrategy = require('passport-local');
const bcrypt = require('bcrypt');
const usersRepository = require('../modules/users/users.repository');

const GENERIC_LOGIN_ERROR = 'Invalid username or password';
let dummyHashPromise;

function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash('DummyPassword-OnlyForTiming', 12);
  }
  return dummyHashPromise;
}

passport.use(new LocalStrategy(
  { usernameField: 'username', passwordField: 'password' },
  async (username, password, done) => {
    try {
      const user = await usersRepository.findByUsernameForLogin(username);
      const passwordHash = user ? user.password_hash : await getDummyHash();
      const passwordMatches = await bcrypt.compare(password, passwordHash);

      if (!user || !passwordMatches || !user.is_active) {
        return done(null, false, { message: GENERIC_LOGIN_ERROR });
      }

      await usersRepository.updateLastLogin(user.id);
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await usersRepository.findById(id);

    if (!user || !user.is_active) {
      return done(null, false);
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
});

module.exports = passport;
