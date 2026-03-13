export const parseError = (err: unknown) => {

    if (!err) {
        return { message: 'Unknown error', raw: err }
    }

    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack
        }
    }

    if (typeof err === 'object') {
        try {
            return JSON.parse(JSON.stringify(err))
        } catch {
            return { message: 'Unserializable error object', raw: String(err) }
        }
    }

    return { message: String(err) }
}