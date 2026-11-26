const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8 },
  role: { type: String, enum: ["admin", "hr", "employee"], default: "admin" }
}, { timestamps: true });

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: "" }
}, { timestamps: true });

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, unique: true, index: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: "" },
  gender: { type: String, enum: ["Male", "Female", "Other", "Prefer not to say"], default: "Prefer not to say" },
  dateOfBirth: { type: Date },
  address: { type: String, default: "" },
  profileImage: { type: String, default: "" },
  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
  designation: { type: String, default: "" },
  joiningDate: { type: Date, default: Date.now },
  salary: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["Active", "Inactive", "On Leave"], default: "Active" }
}, { timestamps: true });

employeeSchema.pre("validate", async function() {
  if (!this.employeeId) {
    const count = await mongoose.model("Employee").countDocuments();
    this.employeeId = `EMP-${String(count + 1).padStart(4, "0")}`;
  }
});

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  date: { type: String, required: true },
  checkIn: { type: Date },
  checkOut: { type: Date },
  status: { type: String, enum: ["Present", "Absent", "Late", "Half Day"], default: "Present" },
  notes: { type: String, default: "" }
}, { timestamps: true });
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

const leaveSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  type: { type: String, enum: ["Casual", "Sick", "Paid", "Unpaid"], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

const payrollSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  month: { type: String, required: true },
  basicSalary: { type: Number, required: true, min: 0 },
  allowances: { type: Number, default: 0, min: 0 },
  deductions: { type: Number, default: 0, min: 0 },
  bonus: { type: Number, default: 0, min: 0 },
  netSalary: { type: Number, required: true, min: 0 },
  paidAt: { type: Date }
}, { timestamps: true });
payrollSchema.index({ employee: 1, month: 1 }, { unique: true });

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = {
  User: mongoose.model("User", userSchema),
  Department: mongoose.model("Department", departmentSchema),
  Employee: mongoose.model("Employee", employeeSchema),
  Attendance: mongoose.model("Attendance", attendanceSchema),
  Leave: mongoose.model("Leave", leaveSchema),
  Payroll: mongoose.model("Payroll", payrollSchema),
  Notification: mongoose.model("Notification", notificationSchema)
};
