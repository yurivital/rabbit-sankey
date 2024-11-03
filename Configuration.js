/**
 * Configuration for accessing to RabbitMQ
 * @type {{password: string, login: string, url: string}}
 */
const Configuration = {
    // Url of rabbitMQ, without vhost.
    url: "http://localhost:15672",
    // Account used for reading statistic and bindings from api management.
    login: "guest",
    password: "guest"
}

export default Configuration;