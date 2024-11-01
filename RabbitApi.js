export default class RabbitApi {

    #cacheMode = "no-cache"
    #credentials = btoa("guest:guest")
    #exchangesEndpoint = "api/exchanges"
    #queuesEndpoint = "api/queues"
    #vhost = encodeURIComponent("/")

    constructor(url) {
        this.url = url
    }

    #createHeaders() {
        const headers = new Headers()
        headers.append('Content-Type', 'application/json')
        headers.append('Accept', 'application/json')
        headers.append('Authorization', `Basic ${this.#credentials}`)
        return headers;
    }

    async #GET(url) {
        const response = await fetch(url, {
            method: "GET", cache: this.#cacheMode, headers: this.#createHeaders()
        })
        if (response.ok) {
            return await response.json()
        } else {
            throw new Error(response.statusText)
        }
    }

    async listExchanges() {
        return await this.#GET(`${this.url}/${this.#exchangesEndpoint}/${this.#vhost}`)
    }

    async getExchangeStats(exchangeName) {
        return await this.#GET(`${this.url}/api/exchanges/${this.#vhost}/${encodeURIComponent(exchangeName)}`)
    }

    async listQueues() {
        return await this.#GET(`${this.url}/${this.#queuesEndpoint}/${this.#vhost}`)
    }

    async getQueueStats(qeueName) {
        return await this.#GET(`${this.url}/api/queues/${this.#vhost}/${encodeURIComponent(qeueName)}`)
    }

    async listBindings(exchangeName) {
        return this.#GET(`${this.url}/api/exchanges/${this.#vhost}/${encodeURIComponent(exchangeName)}/bindings/source`)
    }
}