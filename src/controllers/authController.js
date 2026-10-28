const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Session = require("../models/Session");

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACCESS_COOKIE = "pgsl_access";
const REFRESH_COOKIE = "pgsl_refresh";

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
  maxAge,
});

const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const createAccessToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

const issueSession = async (res, user) => {
  const refreshToken = crypto.randomBytes(64).toString("hex");
  await Session.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  res.cookie(ACCESS_COOKIE, createAccessToken(user), cookieOptions(15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));
};

const clearAuthCookies = (res) => {
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };

  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, options);
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: "OPERATOR",
    });

    return res.status(201).json({
      message: "Registration successful. Please log in.",
      user: userResponse(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    console.error("Registration error:", error.message);
    return res.status(500).json({ message: "Failed to register user" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");
      return res.status(500).json({ message: "Server configuration error" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "Your account is inactive. Contact an administrator." });
    }

    await issueSession(res, user);
    return res.status(200).json({ message: "Login successful", user: userResponse(user) });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Failed to log in" });
  }
};

const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh session required" });
    }

    const session = await Session.findOneAndUpdate(
      {
      tokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
      },
      { revokedAt: new Date() },
      { new: true }
    );
    if (!session) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Invalid or expired refresh session" });
    }

    const user = await User.findById(session.userId);
    if (!user || !user.isActive) {
      await Session.updateOne({ _id: session._id }, { revokedAt: new Date() });
      clearAuthCookies(res);
      return res.status(401).json({ message: "User account not found or inactive" });
    }

    await issueSession(res, user);
    return res.status(200).json({ message: "Session refreshed", user: userResponse(user) });
  } catch (error) {
    console.error("Refresh session error:", error.message);
    return res.status(500).json({ message: "Failed to refresh session" });
  }
};

const me = (req, res) => res.status(200).json({ user: req.user });

const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (refreshToken) {
      await Session.updateOne(
        { tokenHash: hashToken(refreshToken), revokedAt: null },
        { revokedAt: new Date() }
      );
    }
    clearAuthCookies(res);
    return res.status(204).send();
  } catch (error) {
    console.error("Logout error:", error.message);
    return res.status(500).json({ message: "Failed to log out" });
  }
};

module.exports = { register, login, refresh, me, logout };
