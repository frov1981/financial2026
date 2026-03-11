import NodeCache from 'node-cache'

export const cache = new NodeCache({
    stdTTL: 14400, // 4 horas
    checkperiod: 120 // 2 minutos
})