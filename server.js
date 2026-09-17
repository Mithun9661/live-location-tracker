const cookieParser = require("cookie-parser")
const express = require("express")
const http = require("http")
const path = require("path")
const { Server } = require("socket.io")
const config = require("./config")

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: false } })

io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie || ""
    const cookies = Object.fromEntries(cookieHeader.split(";").map(item => {
        const [key, ...value] = item.trim().split("=")
        return [key, decodeURIComponent(value.join("="))]
    }).filter(([key]) => key))
    if (cookies.auth === config.sessionSecret) return next()
    next(new Error("unauthorized"))
})

io.on("connection", socket => {
    socket.on("session:watch", sessionId => {
        if (typeof sessionId === "string" && /^[a-f0-9]{16}$/.test(sessionId)) {
            socket.join(`session:${sessionId}`)
        }
    })
})

app.disable("x-powered-by")
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Referrer-Policy", "no-referrer")
    res.setHeader("Permissions-Policy", "geolocation=(self)")
    next()
})
app.use(cookieParser())
app.use(express.urlencoded({ extended: false, limit: "10kb" }))
app.use(express.json({ limit: "10kb" }))
app.use(express.static(path.join(__dirname, "public")))

app.locals.io = io
app.locals.locations = new Map()
app.locals.config = config
app.use("/", require("./router"))

if (require.main === module) {
    server.listen(config.port, "0.0.0.0", () => {
        console.log(`Live Location Tracker running on port ${config.port}`)
    })
}

module.exports = { app, server }
