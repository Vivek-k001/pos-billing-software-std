const { signToken, verifyPassword } = require("../utils/auth");
const { db } = require("../config/db");

exports.register = async (req, res) => {
  res.status(403).json({
    message: "Registration is disabled. Use the assigned login credentials."
  });
};

exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Query the database for the user
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());

    // Verify user exists and password hash is valid
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (role && user.role !== role) {
      return res.status(403).json({ message: `This account is registered as ${user.role}` });
    }

    const token = signToken({ id: user.id, role: user.role });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
