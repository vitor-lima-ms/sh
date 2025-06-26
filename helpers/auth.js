module.exports.checkAuth = function(req, res, next) {
    const userId = req.session.userid

    if(!userId) {
        res.redirect("/auth/login")
    }

    next()
}