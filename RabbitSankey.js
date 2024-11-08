import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as d3Sankey from 'https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/+esm'
import RabbitApi from "./RabbitApi.js";
import Configuration from "./Configuration.js";


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

    /**
     * Flag that indicate which metric to use : message rate or message volume
     * @type {boolean}
     */
    #useRateAsValueSource = true

    /**
     * Construct a new instance of Sankey Rabbit
     * @param refreshId Identifier of refresh button
     * @param viewportId  Identifier of display area
     * @param stateId  Identifier of state bar
     * @param useRate Set if the message should be used or number of messages
     */
    constructor(refreshId, viewportId, stateId, useRate) {
        this.refreshButton = document.getElementById(refreshId)
        this.viewport = document.getElementById(viewportId)
        this.state = document.getElementById(stateId)
        this.#useRateAsValueSource = useRate
        this.rabbitApi = new RabbitApi(Configuration.url, Configuration.login, Configuration.password)
        this.refreshButton.onclick = async () => {
            try {
                await this.buildDetailedGraph();
                await this.display()
            } catch (e) {
                this.displayMessage(`Error while loading data : ${e.message}`)
            }
        }
    }

    /**
     * Display message in status bar
     * @param message message to display
     */
    displayMessage(message) {
        this.state.innerText = message;
    }

    /**
     * Remove graph
     */
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

        this.displayMessage("Fetch queues list")
        const queues = await this.rabbitApi.listQueues()
        for (const queue of queues) {
            this.#nodes.push({name: queue.name})
            this.displayMessage(`Fetch queue stats for ${queue.name} `)
            const queueStats = await this.rabbitApi.getQueueStats(queue.name)
            // get Incoming exchange for establishing links
            if (queueStats.incoming && queueStats.incoming.length > 0) {
                for (const detailedStats of queueStats.incoming) {
                    this.#populateDetailedNodes(queue.name, detailedStats)
                }
            }
            this.displayMessage(`Fetch queue bindings for ${queue.name} `)
            const bindings = await this.rabbitApi.listBindingOfQueue(queue.name)
            for (const binding of bindings) {
                this.#populateWithBindings(queue.name, binding)
            }
        }
    }

    /**
     * Build nodes and links from queue bindings
     * @param queueName queue name
     * @param binding list of
     */
    #populateWithBindings(queueName, binding) {
        const exchange = binding.source

        // don't display default exchange if not actively used.
        if (exchange === "") {
            return
        }

        // detect if the link is already present
        if (this.#links.find((n) => n.source === exchange && n.target === queueName)) {
            return;
        }

        if (!this.#nodes.find((n) => n.name === exchange)) {
            this.#nodes.push({name: exchange})
        }
        this.#links.push({target: queueName, source: exchange, value: 1})
    }

    /**
     * Build nodes and links based on detailed message statistics
     * @param queueName
     * @param detailedStats
     */
    #populateDetailedNodes(queueName, detailedStats) {
        const exchange = detailedStats.exchange.name
        if (!this.#nodes.find((n) => n.name === exchange)) {
            this.#nodes.push({name: exchange})
        }

        let value = 0.1;
        if (this.#useRateAsValueSource) {
            value = detailedStats.stats.publish_details.rate
        } else {
            value = detailedStats.stats.publish
        }
        this.#links.push({target: queueName, source: exchange, value: value})
    }

    /**
     * Display Sankey diagram based on queues
     * @returns {Promise<void>}
     */
    async display() {

        this.displayMessage(`Create chart`)
        const unit = this.#useRateAsValueSource ? "msg/s" : "messages"
        const fontFamily = "ui-sans-serif"
        const width = this.viewport.getBoundingClientRect().width;
        const height = 800;
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // Create the SVG container.
        const svg = d3.create("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height])
            .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");
        // Constructs and configures a Sankey generator.
        const sankey = d3Sankey.sankey()
            .nodeId(d => d.name)
            .nodeWidth(15)
            .nodePadding(10)
            .extent([[1, 5], [width, height - 20]])

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
            .attr("fill", d => color(d.name))

        const link = svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.5)
            .selectAll()
            .data(links)
            .join("g")
            .style("mix-blend-mode", "multiply")

        link.append("path")
            .attr("d", d3Sankey.sankeyLinkHorizontal())
            .attr("stroke", (d) => color(d.source.name))
            .attr("stroke-width", d => Math.max(1, d.width))

        link.append("title")
            .text(d => `${d.source.name} → ${d.target.name}\n${d.value} ${unit}`)
            .attr("font-family", fontFamily)

        // Adds labels on the nodes.
        svg.append("g")
            .selectAll()
            .data(nodes)
            .join("text")
            .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
            .text(d => d.name)

        // Append the SVG element.
        this.clear()
        this.viewport.append(svg.node())
        this.state.innerText = "Done."
    }
}

window.onload = async (event) => {
    const app = new RabbitSankey("refresh", "viewport", "state", true)
    try {
        await app.buildDetailedGraph();
        await app.display()
    } catch (e) {
        app.displayMessage(`Error while loading data : ${e.message}`)
    }
}
