
"use strict";

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const multer = require("multer");
const sharp = require("sharp");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.MONGODB_URI || !process.env.SESSION_SECRET) {
    console.error("Missing MONGODB_URI or SESSION_SECRET in .env");
    process.exit(1);
}

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            formAction: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"]
        }
    }
}));

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));

// ========================================
// USER MODEL
// ========================================

const User = mongoose.model("User", new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
        type: String, required: true, unique: true,
        lowercase: true, trim: true, maxlength: 254
    },
    passwordHash: { type: String, required: true },
    profilePhoto: { type: String, default: "" }
}, { timestamps: true }));

// ========================================
// BOOKABLE VEHICLES AND SERVER-SIDE PRICES
// ========================================

// These are the vehicles currently listed on the Drive Easy page.
// This starter implementation treats each model as one bookable
// vehicle per pickup city. Add actual fleet/vehicle IDs before launch.
const VEHICLES = {
    "Audi Q3": { pricePerDay: 3500, category: "luxury" },
    "Tata Tiago": { pricePerDay: 1500, category: "economy" },
    "BMW 3 Series": { pricePerDay: 5000, category: "luxury" },
    "Mahindra XEV SUV": { pricePerDay: 3200, category: "suv" },
    "Hyundai i20": { pricePerDay: 1800, category: "economy" },
    "BMW 760i": { pricePerDay: 5500, category: "luxury" },
    "Mahindra XUV 7XO": { pricePerDay: 2000, category: "suv" },
    "Mercedes G-Class": { pricePerDay: 5800, category: "luxury" },
    "Lamborgini Urus": { pricePerDay: 4500, category: "luxury" }
};

const LOCATIONS = [
    "Bengaluru", "Hyderabad", "Chennai",
    "Mumbai", "Kolkata", "Jaipur"
];
    
     // ========================================
// DRIVE EASY — COUPON DISCOUNTS
// ========================================

const COUPONS = {
    SAVE10: {
        type: "percentage",
        value: 10,
        label: "10% off"
    },

    FLAT500: {
        type: "fixed",
        value: 500,
        label: "₹500 off"
    }
};

function calculateCouponDiscount(coupon, subtotal) {
    if (!coupon || subtotal <= 0) {
        return 0;
    }

    const discount = coupon.type === "percentage"
        ? subtotal * coupon.value / 100
        : coupon.value;

    return Math.min(subtotal, Math.round(discount));
}

function getCouponQuote(code, subtotal) {
    const normalizedCode = typeof code === "string"
        ? code.trim().toUpperCase()
        : "";

    if (!normalizedCode) {
        return {
            code: "",
            discountAmount: 0,
            subtotal,
            total: subtotal
        };
    }

    const coupon = COUPONS[normalizedCode];

    if (!coupon) {
        return null;
    }

    const discountAmount = calculateCouponDiscount(
        coupon,
        subtotal
    );

    return {
        code: normalizedCode,
        type: coupon.type,
        value: coupon.value,
        label: coupon.label,
        discountAmount,
        subtotal,
        total: subtotal - discountAmount
    };
}

// ========================================
// BOOKING MODEL
// ========================================

const Booking = mongoose.model("Booking", new mongoose.Schema({
    reference: { type: String, required: true, unique: true, index: true },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    carName: { type: String, required: true },
    location: { type: String, required: true },
    pickup: { type: String, required: true },
    dropoff: { type: String, required: true },
    days: { type: Number, required: true },
    pricePerDay: { type: Number, required: true },
    total: { type: Number, required: true },
    status: {
        type: String,
        enum: ["confirmed", "cancelled"],
        default: "confirmed",
        index: true
    }
}, { timestamps: true }));

// ========================================
// PROFILE PHOTO UPLOAD
// ========================================

const photoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
            return callback(new Error("Choose a JPEG, PNG, or WebP image."));
        }
        callback(null, true);
    }
});

function handlePhotoUpload(req, res, next) {
    photoUpload.single("photo")(req, res, error => {
        if (!error) return next();
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Your photo must be 3 MB or smaller."
            : error.message || "Unable to upload photo.";
        return res.status(400).json({ message });
    });
}

// ========================================
// SESSION AND AUTHENTICATION
// ========================================

app.use(session({
    name: "driveeasy.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: "sessions"
    }),
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24
    }
}));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." }
});

const bookingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many booking attempts. Please try again later." }
});

function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Please log in to continue." });
    }
    next();
}

function isValidEmail(email) {
    return typeof email === "string" &&
        email.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getTodayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isValidDateString(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

function daysBetween(pickup, dropoff) {
    const start = Date.parse(`${pickup}T00:00:00.000Z`);
    const end = Date.parse(`${dropoff}T00:00:00.000Z`);
    return (end - start) / 86400000;
}

// Serve website files.
app.use(express.static(path.join(__dirname, "public")));

// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        database: mongoose.connection.readyState === 1
            ? "connected" : "disconnected"
    });
});

// ========================================
// REGISTER
// ========================================

app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
        const { name, email, password } = req.body || {};

        if (typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string") {
            return res.status(400).json({ message: "Please complete all required fields." });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({ message: "Name must be between 2 and 100 characters." });
        }
        if (!isValidEmail(cleanEmail)) {
            return res.status(400).json({ message: "Please enter a valid email address." });
        }
        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({ message: "Password must be between 8 and 72 characters." });
        }
        if (await User.findOne({ email: cleanEmail })) {
            return res.status(409).json({ message: "An account with this email already exists." });
        }

        const user = await User.create({
            name: cleanName,
            email: cleanEmail,
            passwordHash: await bcrypt.hash(password, 12)
        });

        req.session.userId = user._id.toString();

        return res.status(201).json({
            message: "Account created successfully.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePhoto: user.profilePhoto || ""
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "An account with this email already exists." });
        }
        console.error("Registration error:", error.message);
        return res.status(500).json({ message: "Unable to create account. Please try again." });
    }
});

// ========================================
// LOGIN
// ========================================

app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (typeof email !== "string" || typeof password !== "string") {
            return res.status(400).json({ message: "Enter your email and password." });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ message: "Incorrect email or password." });
        }

        req.session.userId = user._id.toString();
        return res.json({
            message: "Login successful.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePhoto: user.profilePhoto || ""
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);
        return res.status(500).json({ message: "Unable to log in. Please try again." });
    }
});

// ========================================
// CURRENT USER
// ========================================

app.get("/api/auth/me", async (req, res) => {
    try {
        if (!req.session?.userId) {
            return res.status(401).json({ message: "Not logged in." });
        }

        const user = await User.findById(req.session.userId).select("name email profilePhoto");
        if (!user) {
            req.session.destroy(() => {});
            return res.status(401).json({ message: "Account not found." });
        }

        return res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePhoto: user.profilePhoto || ""
            }
        });
    } catch (error) {
        console.error("Session check error:", error.message);
        return res.status(500).json({ message: "Unable to check login status." });
    }
});

// ========================================
// UPDATE PROFILE
// ========================================

app.patch("/api/auth/profile", requireLogin, async (req, res) => {
    try {
        const { name, email } = req.body || {};
        if (typeof name !== "string" || typeof email !== "string") {
            return res.status(400).json({ message: "Please enter your name and email." });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({ message: "Name must be between 2 and 100 characters." });
        }
        if (!isValidEmail(cleanEmail)) {
            return res.status(400).json({ message: "Please enter a valid email address." });
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(401).json({ message: "Your account could not be found. Please log in again." });
        }

        const existing = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
        if (existing) {
            return res.status(409).json({ message: "That email address is already used by another account." });
        }

        user.name = cleanName;
        user.email = cleanEmail;
        await user.save();

        return res.json({
            message: "Profile updated successfully.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePhoto: user.profilePhoto || ""
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "That email address is already in use." });
        }
        console.error("Profile update error:", error.message);
        return res.status(500).json({ message: "Unable to update your profile. Please try again." });
    }
});

// ========================================
// PROFILE PHOTO
// ========================================

app.post("/api/auth/profile-photo", requireLogin, handlePhotoUpload, async (req, res) => {
    let savedFilePath = "";
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Please select a photo to upload." });
        }

        const image = await sharp(req.file.buffer)
            .rotate()
            .resize(512, 512, { fit: "cover", withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();

        const directory = path.join(__dirname, "public", "uploads", "profiles");
        await fs.mkdir(directory, { recursive: true });

        const filename = `${crypto.randomUUID()}.webp`;
        savedFilePath = path.join(directory, filename);
        await fs.writeFile(savedFilePath, image, { flag: "wx" });

        const user = await User.findById(req.session.userId);
        if (!user) {
            await fs.unlink(savedFilePath).catch(() => {});
            return res.status(401).json({ message: "Account not found. Please log in again." });
        }

        const oldPhoto = user.profilePhoto;
        user.profilePhoto = `/uploads/profiles/${filename}`;

        try {
            await user.save();
        } catch (error) {
            await fs.unlink(savedFilePath).catch(() => {});
            savedFilePath = "";
            throw error;
        }

        if (oldPhoto?.startsWith("/uploads/profiles/") &&
            path.basename(oldPhoto) === oldPhoto.slice("/uploads/profiles/".length)) {
            await fs.unlink(path.join(directory, path.basename(oldPhoto))).catch(() => {});
        }

        return res.json({
            message: "Profile photo updated successfully.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePhoto: user.profilePhoto
            }
        });
    } catch (error) {
        if (savedFilePath) await fs.unlink(savedFilePath).catch(() => {});
        console.error("Profile photo upload error:", error.message);
        return res.status(400).json({
            message: "Unable to process this photo. Choose a valid JPEG, PNG, or WebP image."
        });
    }
});

// ========================================
// DRIVE EASY — VALIDATE COUPON
// ========================================

app.post("/api/coupons/validate", requireLogin, bookingLimiter, async (req, res) => {
    try {
        const { couponCode, carName, location, pickup, dropoff } = req.body || {};

        const vehicle = VEHICLES[carName];

        if (!vehicle) {
            return res.status(400).json({
                message: "Please select a valid car."
            });
        }

        if (!LOCATIONS.includes(location)) {
            return res.status(400).json({
                message: "Please select a valid pickup location."
            });
        }

        if (
            !isValidDateString(pickup) ||
            !isValidDateString(dropoff) ||
            pickup < getTodayString()
        ) {
            return res.status(400).json({
                message: "Please select valid rental dates."
            });
        }

        const days = daysBetween(pickup, dropoff);

        if (!Number.isInteger(days) || days < 1 || days > 30) {
            return res.status(400).json({
                message: "Return date must be after pickup. Maximum 30 days."
            });
        }

        const subtotal = vehicle.pricePerDay * days;
        const coupon = getCouponQuote(couponCode, subtotal);

        if (!coupon) {
            return res.status(400).json({
                message: "Invalid coupon code."
            });
        }

        return res.json({
            message: "Coupon applied successfully.",
            coupon
        });

    } catch (error) {
        console.error("Coupon validation error:", error.message);

        return res.status(500).json({
            message: "Unable to validate coupon."
        });
    }
});

// ========================================
// CREATE BOOKING
// ========================================


app.post("/api/bookings", requireLogin, bookingLimiter, async (req, res) => {
    try {
        const {
            carName,
            location,
            pickup,
            dropoff,
            couponCode
        } = req.body || {};

        if (
            typeof carName !== "string" ||
            typeof location !== "string" ||
            !isValidDateString(pickup) ||
            !isValidDateString(dropoff)
        ) {
            return res.status(400).json({
                message: "Choose a valid car, pickup location, and rental dates."
            });
        }

        const vehicle = VEHICLES[carName];

        if (!vehicle) {
            return res.status(400).json({
                message: "This vehicle is not available for booking."
            });
        }

        if (!LOCATIONS.includes(location)) {
            return res.status(400).json({
                message: "Choose a supported pickup location."
            });
        }

        if (pickup < getTodayString()) {
            return res.status(400).json({
                message: "Pickup date cannot be in the past."
            });
        }

        const days = daysBetween(pickup, dropoff);

        if (!Number.isInteger(days) || days < 1 || days > 30) {
            return res.status(400).json({
                message: "Return date must be after pickup. Bookings can be up to 30 days."
            });
        }

        // Check whether this car is already booked for these dates.
        const conflict = await Booking.findOne({
            carName,
            location,
            status: "confirmed",
            pickup: { $lt: dropoff },
            dropoff: { $gt: pickup }
        });

        if (conflict) {
            return res.status(409).json({
                message: "This car is already booked for some or all of those dates. Please choose other dates or another car."
            });
        }

        // Calculate the rental price on the server.
        const subtotal = vehicle.pricePerDay * days;

        // Validate the coupon on the server.
        const coupon = getCouponQuote(
            couponCode,
            subtotal
        );

        if (!coupon) {
            return res.status(400).json({
                message: "Invalid coupon code. Please check your code."
            });
        }

        // Save the discounted booking to MongoDB.
        const booking = await Booking.create({
            reference: `DE-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
            user: req.session.userId,
            carName,
            location,
            pickup,
            dropoff,
            days,
            pricePerDay: vehicle.pricePerDay,
            subtotal: coupon.subtotal,
            couponCode: coupon.code || "",
            couponDiscount: coupon.discountAmount,
            total: coupon.total,
            status: "confirmed"
        });

        return res.status(201).json({
            message: "Your reservation has been saved successfully.",
            booking: {
                id: booking._id,
                reference: booking.reference,
                carName: booking.carName,
                location: booking.location,
                pickup: booking.pickup,
                dropoff: booking.dropoff,
                days: booking.days,
                pricePerDay: booking.pricePerDay,
                subtotal: booking.subtotal,
                couponCode: booking.couponCode,
                couponDiscount: booking.couponDiscount,
                total: booking.total,
                status: booking.status,
                createdAt: booking.createdAt
            }
        });

    } catch (error) {
        console.error("Create booking error:", error.message);

        return res.status(500).json({
            message: "Unable to create your booking. Please try again."
        });
    }
});
 

// ========================================
// GET BOOKINGS FOR THE LOGGED-IN CUSTOMER
// ========================================

app.get("/api/bookings", requireLogin, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.session.userId })
            .sort({ createdAt: -1 })
            .lean();

        return res.json({
            bookings: bookings.map(booking => ({
                id: booking._id,
                reference: booking.reference,
                carName: booking.carName,
                location: booking.location,
                pickup: booking.pickup,
                dropoff: booking.dropoff,
                days: booking.days,
                pricePerDay: booking.pricePerDay,
                total: booking.total,
                status: booking.status,
                createdAt: booking.createdAt
            }))
        });
    } catch (error) {
        console.error("Get bookings error:", error.message);
        return res.status(500).json({ message: "Unable to load your bookings." });
    }
});

// ========================================
// CANCEL A CUSTOMER'S OWN BOOKING
// ========================================

app.patch("/api/bookings/:id/cancel", requireLogin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid booking." });
        }

        const booking = await Booking.findOne({
            _id: req.params.id,
            user: req.session.userId
        });

        if (!booking) {
            return res.status(404).json({ message: "Booking not found." });
        }

        if (booking.status === "cancelled") {
            return res.status(400).json({ message: "This booking is already cancelled." });
        }

        booking.status = "cancelled";
        await booking.save();

        return res.json({
            message: "Booking cancelled successfully.",
            booking: {
                id: booking._id,
                reference: booking.reference,
                status: booking.status
            }
        });
    } catch (error) {
        console.error("Cancel booking error:", error.message);
        return res.status(500).json({ message: "Unable to cancel this booking." });
    }
});

// ========================================
// LOGOUT
// ========================================

app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(error => {
        if (error) {
            return res.status(500).json({ message: "Unable to log out." });
        }

        res.clearCookie("driveeasy.sid", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production"
        });

        return res.json({ message: "Logged out successfully." });
    });
});

// Keep this handler last.
app.use((req, res) => {
    res.status(404).json({ message: "Page or API endpoint not found." });
});

// ========================================
// START SERVER
// ========================================

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
        app.listen(PORT, () => {
            console.log(`Drive Easy server running at http://localhost:${PORT}`);
        });
    })
    .catch(error => {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    });