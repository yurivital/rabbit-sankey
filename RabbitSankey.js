import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as d3Sankey from 'https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/+esm'
import RabbitApi from "./RabbitApi.js";

/**
 * Handle display  and side effects
 */
class RabbitSankey {

    /**
     * Sankey nodes.
     * @example {"name" : "my.queue"}
     * @type {Array}
     */
    #nodes = []

    /**
     * Sankey links between nodes
     * @example {"source": "my.exchange"; "target": "my.queue", "value": 1}
     * @type {Array}
     */
    #links = []

    #valueSource = "rate"

    /**
     * Construct a new instance of Sankey Rabbit
     * @param refreshId Identifier of refresh button
     * @param viewportId  Identifier of display area
     * @param stateId  Identifier of state bar
     */
    constructor(refreshId, viewportId, stateId) {
        this.refreshButton = document.getElementById(refreshId)
        this.viewport = document.getElementById(viewportId)
        this.state = document.getElementById(stateId)
        this.#setReady()
        this.rabbitApi = new RabbitApi("http://localhost:15672")
        this.refreshButton.onclick = async () => {
            await this.display()
        }
    }

    #setReady() {
        this.viewport.innerText = "Ready";
    }

    clear() {
        this.viewport.innerText = ""
    }

    /**
     * Build graph when management plugin is in detailed rates mode
     * see https://www.rabbitmq.com/docs/management#rates-mode
     * @returns {Promise<void>}
     */
    async buildDetailedGraph() {
        this.#nodes = []
        this.#links = []

        const queues = await this.rabbitApi.listQueues()
        for (const queue of queues) {
            this.#nodes.push({name: queue.name})
            const queueStats = await this.rabbitApi.getQueueStats(queue.name)
            // get Incoming exchange for establishing links
            if (queueStats.incoming && queueStats.incoming.length > 0) {
                for (const detailedStats of queueStats.incoming) {
                    this.#populateDetailedNodes(queue.name, detailedStats)
                }
            } else {
                // get here binding for queues
            }
        }
    }

    #populateDetailedNodes(queueName, detailedStats) {
        const exchange = detailedStats.exchange.name
        if (!this.#nodes.find((n) => n.name === exchange)) {
            this.#nodes.push({name: exchange})
        }

        let value = 0.1;
        if (this.#valueSource === "rate") {
            value = detailedStats.stats.publish_details.rate
        } else {
            value = detailedStats.stats.publish
        }
        this.#links.push({target: queueName, source: exchange, value: value})
    }

    async buildGraph() {
        const exchangesJob = this.rabbitApi.listExchanges()
        const queuesJob = this.rabbitApi.listQueues()
        await Promise.all([exchangesJob, queuesJob])
        const exchanges = await exchangesJob
        const queues = await queuesJob
        // Build here Graph
        this.#nodes = exchanges.map(exchange => {
            return {name: exchange.name}
        }).concat(queues.map(queue => {
            return {name: queue.name}
        }))

        for (const queue of queues) {
            const queueStat = await this.rabbitApi.getQueueStats(queue.name)
            console.log(queueStat)
        }

        // get stats
        for (const exchange of exchanges) {
            const exchangeStats = this.rabbitApi.getExchangeStats(exchange.name)
            console.log(exchangeStats)
            const bindings = await this.rabbitApi.listBindings(exchange.name)

            const links = bindings.map((binding) => {
                return {source: binding.source, target: binding.destination, value: 1}
            })
            this.#links.push(...links)
        }
        console.log(this.#nodes)
        console.log(this.#links)
    }

    /**
     * Display Sankey diagram based on queues
     * @returns {Promise<void>}
     */
    async display() {
        const width = 640;
        const height = 400;
        const color = d3.scaleOrdinal(d3.schemeCategory10);
        // Create the SVG container.
        const svg = d3.create("svg")
            .attr("width", width)
            .attr("height", height)

        // Constructs and configures a Sankey generator.
        const sankey = d3Sankey.sankey()
            .nodeId(d => d.name)
            .nodeWidth(15)
            .nodePadding(10)
            .extent([[1, 5], [width - 1, height - 5]])

        // Applies it to the data. We make a copy of the nodes and links objects
        // so to avoid mutating the original.
        const {nodes, links} = sankey({
            nodes: this.#nodes, links: this.#links
        })

        svg.append("g")
            .attr("stroke", "#000")
            .selectAll()
            .data(nodes)
            .join("rect")
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", d => d.x1 - d.x0)
            .attr("fill", d => color(d.category))

        const link = svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.5)
            .selectAll()
            .data(links)
            .join("g")
            .style("mix-blend-mode", "multiply")

        link.append("path")
            .attr("d", d3Sankey.sankeyLinkHorizontal())
            .attr("stroke", (d) => color(d.source.category))
            .attr("stroke-width", d => Math.max(1, d.width))

        link.append("title")
            .text(d => `${d.source.name} → ${d.target.name}\n${d3.format(d.value)} msg/s`)

        // Adds labels on the nodes.
        svg.append("g")
            .selectAll()
            .data(nodes)
            .join("text")
            .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
            .text(d => d.name);
        // Append the SVG element.
        this.clear()
        this.viewport.append(svg.node())
    }
}

window.onload = async (event) => {
    const app = new RabbitSankey("refresh", "viewport", "state")
    await app.buildDetailedGraph()
    await app.display()
}
