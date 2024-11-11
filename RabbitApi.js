export default class RabbitApi {

    #cacheMode = "no-cache"
    #credentials = btoa("guest:guest")
    #queuesEndpoint = "api/queues"
    #vhost = encodeURIComponent("/")

    constructor(url, login, password) {
        this.url = url
        this.#credentials = btoa(`${login}:${password}`)
    }

    /**
     * Set current vhost
     * @param vhost
     */
    set vhost(vhost) {
        this.#vhost = encodeURIComponent(vhost)
    }

    /**
     * Create http headers needed for management api
     * @returns {Headers}
     */
    #createHeaders() {
        const headers = new Headers()
        headers.append('Content-Type', 'application/json')
        headers.append('Accept', 'application/json')
        headers.append('Authorization', `Basic ${this.#credentials}`)
        return headers;
    }

    /**
     * Perform a get http query against rabbitmq api
     * @param url Address of rabbitMQ management api
     * @returns {Promise<any>} Promise this json
     */
    async #GET(url) {
        const response = await fetch(url, {
            method: "GET", cache: this.#cacheMode, headers: this.#createHeaders()
        })
        if (response.ok) {
            return response.json()
        } else {
            throw new Error(response.statusText)
        }
    }

    /**
     * Return all vhosts
     * @returns {Promise<*>}
     */
    listVhost()
    {
        return this.#GET(`${this.url}/api/vhosts`)
    }


    /**
     * Return all queues in vhost
     * @returns {Promise<*>}
     */
    listQueues() {
        return this.#GET(`${this.url}/${this.#queuesEndpoint}/${this.#vhost}`)
    }

    /**
     * Return statistic for specified queue
     * @param qeueName
     * @returns {Promise<*>}
     */
    getQueueStats(qeueName) {
        return this.#GET(`${this.url}/${this.#queuesEndpoint}/${this.#vhost}/${encodeURIComponent(qeueName)}`)
    }

    /**
     * Return binding for specified queue
     * @param queueName
     * @returns {Promise<*>}
     */
    listBindingOfQueue(queueName) {
        return this.#GET(`${this.url}/${this.#queuesEndpoint}/${this.#vhost}/${encodeURIComponent(queueName)}/bindings`)
    }
}