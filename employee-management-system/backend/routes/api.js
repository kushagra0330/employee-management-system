const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { body, validationResult } = require("express-validator");
const { User, Employee, Department, Attendance, Leave, Payroll, Notification } = require("../models");
const { protect, allowRoles } = require("../middleware/auth");

const router = express.Router();
const upload = multer({
  dest: path.join(__dirname, "../uploads"),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed."));
  }
});

const admin = [protect, allowRoles("admin", "hr")];
const validation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  next();
};

function tokenFor(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "1d" });
}

// Authentication
router.post("/auth/register", [
  body("name").trim().notEmpty().withMessage("Name is required."),
  body("email").isEmail().withMessage("Enter a valid email."),
  body("password").isLength({ min: 8 }).withMessage("Password must contain at least 8 characters.")
], validation, async (req, res, next) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.status(403).json({ message: "Registration is closed after the first administrator is created. Ask an administrator to create accounts." });
    const { name, email, password } = req.body;
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), role: "admin" });
    res.status(201).json({ token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { next(e); }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(String(req.body.password || ""), user.password))) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }
    res.json({ token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { next(e); }
});
router.get("/auth/me", protect, (req, res) => res.json({ user: req.user }));

// Dashboard
router.get("/dashboard", protect, async (req, res, next) => {
  try {
    const [totalEmployees, activeEmployees, departments, pendingLeaves, recentEmployees, presentToday, departmentStats] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ status: "Active" }),
      Department.countDocuments(),
      Leave.countDocuments({ status: "Pending" }),
      Employee.find().sort({ createdAt: -1 }).limit(5).populate("department", "name"),
      Attendance.countDocuments({ date: new Date().toISOString().slice(0, 10), status: { $in: ["Present", "Late"] } }),
      Employee.aggregate([{ $group: { _id: "$department", count: { $sum: 1 } } }, { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "department" } }, { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } }, { $project: { name: { $ifNull: ["$department.name", "Unassigned"] }, count: 1 } }])
    ]);
    res.json({ totalEmployees, activeEmployees, inactiveEmployees: totalEmployees - activeEmployees, departments, pendingLeaves, presentToday, recentEmployees, departmentStats });
  } catch (e) { next(e); }
});

// Employees
router.get("/employees", protect, async (req, res, next) => {
  try {
    const { search = "", department = "", status = "", page = 1, limit = 10 } = req.query;
    const filter = {};
    if (search) filter.$or = ["fullName", "email", "employeeId", "designation"].map(k => ({ [k]: { $regex: search, $options: "i" } }));
    if (department) filter.department = department;
    if (status) filter.status = status;
    const p = Math.max(1, Number(page)), l = Math.min(100, Math.max(1, Number(limit)));
    const [items, total] = await Promise.all([
      Employee.find(filter).populate("department", "name").sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
      Employee.countDocuments(filter)
    ]);
    res.json({ items, total, page: p, pages: Math.ceil(total / l) });
  } catch (e) { next(e); }
});
router.get("/employees/:id", protect, async (req, res, next) => {
  try {
    const item = await Employee.findById(req.params.id).populate("department", "name");
    if (!item) return res.status(404).json({ message: "Employee not found." });
    res.json(item);
  } catch (e) { next(e); }
});
router.post("/employees", admin, upload.single("profileImage"), async (req, res, next) => {
  try {
    const data = { ...req.body, salary: Number(req.body.salary || 0) };
    if (req.file) data.profileImage = `/uploads/${req.file.filename}`;
    const item = await Employee.create(data);
    res.status(201).json(item);
  } catch (e) { next(e); }
});
router.put("/employees/:id", admin, upload.single("profileImage"), async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.salary !== undefined) data.salary = Number(data.salary);
    if (req.file) data.profileImage = `/uploads/${req.file.filename}`;
    const item = await Employee.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }).populate("department", "name");
    if (!item) return res.status(404).json({ message: "Employee not found." });
    res.json(item);
  } catch (e) { next(e); }
});
router.delete("/employees/:id", admin, async (req, res, next) => {
  try {
    const item = await Employee.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Employee not found." });
    await Promise.all([Attendance.deleteMany({ employee: item._id }), Leave.deleteMany({ employee: item._id }), Payroll.deleteMany({ employee: item._id })]);
    res.json({ message: "Employee and related records deleted." });
  } catch (e) { next(e); }
});

// Departments
router.get("/departments", protect, async (req, res, next) => {
  try {
    const items = await Department.find().sort({ name: 1 });
    const counts = await Employee.aggregate([{ $group: { _id: "$department", count: { $sum: 1 } } }]);
    res.json(items.map(d => ({ ...d.toObject(), employeeCount: counts.find(c => String(c._id) === String(d._id))?.count || 0 })));
  } catch (e) { next(e); }
});
router.post("/departments", admin, async (req, res, next) => {
  try { res.status(201).json(await Department.create({ name: req.body.name, description: req.body.description })); }
  catch (e) { next(e); }
});
router.put("/departments/:id", admin, async (req, res, next) => {
  try {
    const item = await Department.findByIdAndUpdate(req.params.id, { name: req.body.name, description: req.body.description }, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: "Department not found." });
    res.json(item);
  } catch (e) { next(e); }
});
router.delete("/departments/:id", admin, async (req, res, next) => {
  try {
    const used = await Employee.countDocuments({ department: req.params.id });
    if (used) return res.status(409).json({ message: "Move employees to another department before deleting this department." });
    const item = await Department.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Department not found." });
    res.json({ message: "Department deleted." });
  } catch (e) { next(e); }
});

// Attendance
router.get("/attendance", protect, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.date) filter.date = req.query.date;
    if (req.query.employee) filter.employee = req.query.employee;
    const items = await Attendance.find(filter).populate("employee", "fullName employeeId").sort({ date: -1, createdAt: -1 }).limit(200);
    res.json(items);
  } catch (e) { next(e); }
});
router.post("/attendance", admin, async (req, res, next) => {
  try {
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const item = await Attendance.findOneAndUpdate(
      { employee: req.body.employee, date },
      { $set: { status: req.body.status || "Present", notes: req.body.notes || "", checkIn: req.body.checkIn ? new Date(req.body.checkIn) : new Date(), checkOut: req.body.checkOut ? new Date(req.body.checkOut) : undefined } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(item);
  } catch (e) { next(e); }
});
router.patch("/attendance/:id/checkout", admin, async (req, res, next) => {
  try {
    const item = await Attendance.findByIdAndUpdate(req.params.id, { checkOut: new Date() }, { new: true });
    if (!item) return res.status(404).json({ message: "Attendance record not found." });
    res.json(item);
  } catch (e) { next(e); }
});

// Leaves
router.get("/leaves", protect, async (req, res, next) => {
  try {
    const items = await Leave.find().populate("employee", "fullName employeeId").sort({ createdAt: -1 }).limit(300);
    res.json(items);
  } catch (e) { next(e); }
});
router.post("/leaves", protect, async (req, res, next) => {
  try {
    if (new Date(req.body.endDate) < new Date(req.body.startDate)) return res.status(400).json({ message: "End date must be on or after start date." });
    const item = await Leave.create({ employee: req.body.employee, type: req.body.type, startDate: req.body.startDate, endDate: req.body.endDate, reason: req.body.reason });
    res.status(201).json(item);
  } catch (e) { next(e); }
});
router.patch("/leaves/:id/status", admin, async (req, res, next) => {
  try {
    if (!["Approved", "Rejected"].includes(req.body.status)) return res.status(400).json({ message: "Status must be Approved or Rejected." });
    const item = await Leave.findByIdAndUpdate(req.params.id, { status: req.body.status, reviewedBy: req.user._id }, { new: true }).populate("employee", "fullName employeeId");
    if (!item) return res.status(404).json({ message: "Leave request not found." });
    res.json(item);
  } catch (e) { next(e); }
});

// Payroll
router.get("/payroll", protect, async (req, res, next) => {
  try {
    const items = await Payroll.find().populate("employee", "fullName employeeId").sort({ month: -1 }).limit(300);
    res.json(items);
  } catch (e) { next(e); }
});
router.post("/payroll", admin, async (req, res, next) => {
  try {
    const basicSalary = Number(req.body.basicSalary), allowances = Number(req.body.allowances || 0), deductions = Number(req.body.deductions || 0), bonus = Number(req.body.bonus || 0);
    if ([basicSalary, allowances, deductions, bonus].some(n => !Number.isFinite(n) || n < 0)) return res.status(400).json({ message: "Salary amounts must be valid non-negative numbers." });
    const netSalary = basicSalary + allowances + bonus - deductions;
    if (netSalary < 0) return res.status(400).json({ message: "Deductions cannot exceed total earnings." });
    const item = await Payroll.create({ employee: req.body.employee, month: req.body.month, basicSalary, allowances, deductions, bonus, netSalary });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// Notifications
router.get("/notifications", protect, async (req, res, next) => {
  try { res.json(await Notification.find().sort({ createdAt: -1 }).limit(30)); }
  catch (e) { next(e); }
});
router.patch("/notifications/read-all", protect, async (req, res, next) => {
  try { await Notification.updateMany({}, { read: true }); res.json({ message: "Notifications marked as read." }); }
  catch (e) { next(e); }
});

module.exports = router;
