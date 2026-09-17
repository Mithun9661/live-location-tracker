const { after, before, test } = require("node:test")
const assert = require("node:assert/strict")

process.env.APP_USERNAME = "tester"
process.env.APP_PASSWORD = "test-password"
process.env.SESSION_SECRET = "test-session-secret"

const { server } = require("../server")
let baseUrl

before(async () => {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
    await new Promise(resolve => server.close(resolve))
})

test("health endpoint is available", async () => {
    const response = await fetch(`${baseUrl}/healthz`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: "ok" })
})

test("dashboard redirects unauthenticated visitors", async () => {
    const response = await fetch(`${baseUrl}/`, { redirect: "manual" })
    assert.equal(response.status, 302)
    assert.equal(response.headers.get("location"), "/login")
})

test("authenticated owner can create and end a session", async () => {
    const login = await fetch(`${baseUrl}/login`, {
        method: "POST", redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "username=tester&password=test-password"
    })
    const cookie = login.headers.get("set-cookie").split(";")[0]
    const created = await fetch(`${baseUrl}/api/sessions`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test device" })
    })
    assert.equal(created.status, 201)
    const session = await created.json()
    assert.equal(session.name, "Test device")
    assert.match(session.shareUrl, /\/share\/[a-f0-9]+$/)
    const ended = await fetch(`${baseUrl}/api/sessions/${session.id}`, { method: "DELETE", headers: { Cookie: cookie } })
    assert.equal(ended.status, 204)
})

test("location endpoint rejects an unknown session", async () => {
    const response = await fetch(`${baseUrl}/api/share/not-a-session/location`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: 999, lng: 999 })
    })
    assert.equal(response.status, 404)
})
