const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

const isFunction = obj => typeof obj === 'function'
const isObject = obj => !!(obj && typeof obj === 'object')
const isPromise = obj => obj instanceof Promise
const isThenable = obj => (isFunction(obj) || isObject(obj)) && 'then' in obj

const transition = (promise, state, result) => {
    if (promise.state !== PENDING) return
    promise.state = state
    promise.result = result
    setTimeout(() => {
        handleCbs(promise.callbacks, state, result)
    })
}

function Promise(fn) {
    this.result = null
    this.state = PENDING
    this.callbacks = []

    const onFulfilled = value => transition(this, FULFILLED, value)
    const onRejected = reason => transition(this, REJECTED, reason)

    let ignore = false
    const resolve = value => {
        if (ignore) return
        ignore = true
        resolvePromise(this, value, onFulfilled, onRejected)
    }
    const reject = reason => {
        if (ignore) return
        ignore = true
        onRejected(reason)
    }

    try {
        fn(resolve, reject)
    } catch(error) {
        reject(error)
    }
}

Promise.prototype.then = function(onFulfilled, onRejected) {
    return new Promise((resolve, reject) => {
        const callback = { onFulfilled, onRejected, resolve, reject }

        if (this.state === PENDING) {
            this.callbacks.push(callback)
        } else {
            setTimeout(() => handleCb(callback, this.state, this.result))
        }
    })
}

function resolvePromise(promise, x, resolve, reject) {
    if (promise === x) {
        return reject(new TypeError('Cannot fulfill promise with itself'))
    }

    if (isPromise(x)) {
        return x.then(resolve, reject)
    }

    if (isThenable(x)) {
        try {
            let then = x.then
            if (isFunction(then)) {
                return new Promise(then.bind(x)).then(resolve, reject)
            }
        } catch(error) {
            reject(error)
        }
    }

    resolve(x)
}

function handleCb(callback, state, result) {
    const { onFulfilled, onRejected, resolve, reject } = callback

    try {
        if (state === FULFILLED) {
            isFunction(onFulfilled) ? resolve(onFulfilled(result)) : resolve(result)
        } else if (state === REJECTED) {
            isFunction(onRejected) ? resolve(onRejected(result)) : reject(result)
        }
    } catch(error) {
        reject(error)
    }
}

function handleCbs(callbacks, state, result) {
    while(callbacks.length) {
        handleCb(callbacks.shift(), state, result)
    }
}

Promise.prototype.catch = function(onRejected) {
    return this.then(null, onRejected)
}

Promise.prototype.finally = function(fn) {
    return this.then(
        value => Promise.resolve(fn()).then(() => value),
        err => Promise.resolve(fn()).then(() => { throw err })
    )
}

Promise.resolve = value => new Promise((resolve) => resolve(value))
Promise.reject = err => new Promise((null, reject) => reject(err))
Promise.all = function(arr) {
    return new Promise((resolve, reject) => {
        let count = 0
        let result = []
        for (let i = 0; i < arr.length; i++) {
            Promise.resolve(arr[i]).then(value => {
                result[i] = value
                if (++count === arr.length) {
                    resolve(result)
                }
            }, err => {
                reject(err)
            })
        }
    })
}
Promise.race = function(arr) {
    return new Promise((resolve, reject) => {
        for (let i = 0; i < arr.length; i++) {
            Promise.resolve(arr[i]).then(
                value => resolve(value),
                err => reject(err)
            )
        } 
    })
}
Promise.promisify = function(fn) {
    return function() {
        const args = [].prototype.slice.call(arguments)
        return new Promise((resolve, reject) => {
            fn.apply(null, args.concat((err, value) => {
                err ? reject(err) : resolve(value)
            }))
        })
    }
}

Promise.defer = Promise.deferred = function() {
    let dfd = {}
    dfd.promise = new Promise((resolve, reject) => {
        dfd.resolve = resolve
        dfd.reject = reject
    })
    return dfd
}

module.exports = Promise
