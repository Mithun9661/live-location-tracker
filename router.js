const crypto = require("crypto")
const express = require("express")
const path = require("path")

const router = express.Router()
const views = path.join(__dirname, "views")
const loginAttempts = new Map()

function safeEqual(left, right) {
    const a = Buffer.from(String(left))
    const b = Buffer.from(String(right))
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function isAuthenticated(req) {
    return Boolean(req.cookies.auth && safeEqual(req.cookies.auth, req.app.locals.config.sessionSecret))
}

function requireAuth(req, res, next) {
    if (isAuthenticated(req)) return next()
    return res.redirect("/login")
}

function randomCode(bytes = 8) {
    return crypto.randomBytes(bytes).toString("hex")
}

router.get("/healthz", (req, res) => res.json({ status: "ok" }))

router.get("/login", (req, res) => {
    if (isAuthenticated(req)) return res.redirect("/")
    res.sendFile(path.join(views, "login.html"))
})

router.post("/login", (req, res) => {
    const config = req.app.locals.config
    const key = req.ip
    const attempt = loginAttempts.get(key) || { count: 0, resetAt: 0 }
    const now = Date.now()
    if (attempt.resetAt < now) {
        attempt.count = 0
        attempt.resetAt = now + 15 * 60 * 1000
    }
    if (attempt.count >= 10) return res.redirect("/login?error=locked")

    if (safeEqual(req.body.username || "", config.username) && safeEqual(req.body.password || "", config.password)) {
        loginAttempts.delete(key)
        res.cookie("auth", config.sessionSecret, {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 12 * 60 * 60 * 1000
        })
        return res.redirect("/")
    }

    attempt.count += 1
    loginAttempts.set(key, attempt)
    return res.redirect("/login?error=invalid")
})

router.post("/logout", (req, res) => {
    res.clearCookie("auth")
    res.redirect("/login")
})

router.get("/share/:code", (req, res) => {
    const session = req.app.locals.locations.get(req.params.code)
    if (!session || session.expiresAt < Date.now()) return res.status(404).sendFile(path.join(views, "not-found.html"))
    res.sendFile(path.join(views, "share.html"))
})

router.post("/api/share/:code/location", (req, res) => {
    const session = req.app.locals.locations.get(req.params.code)
    const lat = Number(req.body.lat)
    const lng = Number(req.body.lng)
    const accuracy = Number(req.body.accuracy)

    if (!session || session.expiresAt < Date.now()) return res.status(404).json({ error: "Sharing session expired" })
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: "Invalid coordinates" })
    }

    session.location = {
        lat,
        lng,
        accuracy: Number.isFinite(accuracy) ? Math.max(0, accuracy) : null,
        updatedAt: new Date().toISOString()
    }
    req.app.locals.io.to(`session:${session.id}`).emit("location:update", session.location)
    res.json({ ok: true, updatedAt: session.location.updatedAt })
})

router.use(requireAuth)

router.get("/", (req, res) => res.sendFile(path.join(views, "home.html")))
router.get("/map/:id", (req, res) => res.sendFile(path.join(views, "map.html")))

router.get("/api/sessions", (req, res) => {
    const now = Date.now()
    const sessions = []
    for (const [code, session] of req.app.locals.locations.entries()) {
        if (session.expiresAt < now) {
            req.app.locals.locations.delete(code)
            continue
        }
        sessions.push({ id: session.id, code, name: session.name, expiresAt: session.expiresAt, location: session.location })
    }
    res.json(sessions)
})

router.post("/api/sessions", (req, res) => {
    const name = String(req.body.name || "Shared device").trim().slice(0, 50) || "Shared device"
    const code = randomCode(6)
    const session = { id: randomCode(8), name, expiresAt: Date.now() + 24 * 60 * 60 * 1000, location: null }
    req.app.locals.locations.set(code, session)
    const origin = req.app.locals.config.publicBaseUrl || `${req.protocol}://${req.get("host")}`
    res.status(201).json({ ...session, code, shareUrl: `${origin}/share/${code}` })
})

router.get("/api/sessions/:id", (req, res) => {
    const session = [...req.app.locals.locations.values()].find(item => item.id === req.params.id)
    if (!session || session.expiresAt < Date.now()) return res.status(404).json({ error: "Session not found" })
    res.json({ id: session.id, name: session.name, expiresAt: session.expiresAt, location: session.location })
})

router.delete("/api/sessions/:id", (req, res) => {
    for (const [code, session] of req.app.locals.locations.entries()) {
        if (session.id === req.params.id) {
            req.app.locals.locations.delete(code)
            req.app.locals.io.to(`session:${session.id}`).emit("session:ended")
            return res.status(204).end()
        }
    }
    res.status(404).json({ error: "Session not found" })
})

module.exports = router
