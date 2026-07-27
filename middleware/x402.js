const { paymentMiddleware, x402ResourceServer } = require("@x402/express");
const { registerExactEvmScheme } = require("@x402/evm/exact/server");
const { HTTPFacilitatorClient } = require("@x402/core/server");

const WALLET = process.env.WALLET_ADDRESS;
const FACILITATOR = "https://facilitator.xpay.sh";

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR });
const resourceServer = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(resourceServer);

// Static schema for all data endpoints
const staticDataSchema = {
  info: {
    input: {
      type: "http",
      method: "GET"
    }
  },
  schema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
      input: {
        type: "object",
        properties: {
          type: {
            type: "string",
            const: "http"
          },
          method: {
            type: "string",
            enum: ["GET"]
          }
        },
        required: ["type", "method"],
        additionalProperties: false
      },
      output: {
        type: "object",
        properties: {
          type: {
            type: "string"
          },
          data: {
            type: "object"
          }
        },
        required: ["type"]
      }
    },
    required: ["input"]
  }
};

const baseX402Middleware = paymentMiddleware(
  {
    "GET /finance/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Finance data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /economy/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Economy data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /geo/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Geography data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /health/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Health data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /environment/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Environment data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /science/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Science data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /legal/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Legal data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /social/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Social data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /sports/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Sports data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /media/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Media data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /knowledge/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Knowledge data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /compute/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Compute data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /security/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Security data endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /ai/*": {
      accepts: {
        scheme: "exact",
        price: "$0.05",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "AI endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /ns/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "NS compute endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "POST /ai/*": {
      accepts: {
        scheme: "exact",
        price: "$0.05",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "AI endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "POST /ns/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "NS compute endpoints",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /temporal/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Temporal and calendar data endpoint",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /geospatial/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Geospatial and location data endpoint",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /reference/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Reference data endpoint",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /search/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Search and discovery endpoint",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call data endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /memory/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Agent memory read",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "POST /memory/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Agent memory and key-value storage",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "DELETE /memory/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Memory key deletion",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "POST /logging/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Append-only log storage for agents",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /logging/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Log retrieval",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "POST /tasks/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Agent task queue management",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /tasks/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Task queue read",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "POST /notify/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Webhook notification and event firing",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /notify/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Notification read",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "POST /verify/*": {
      accepts: {
        scheme: "exact",
        price: "$0.005",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Data validation and format verification",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "POST /coordination/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Distributed coordination and locking",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /coordination/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Coordination state read",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "POST /secrets/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Encrypted secret storage and cryptographic operations",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "GET /secrets/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Secret retrieval",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "DELETE /secrets/*": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Secret deletion",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
    "POST /simulate/*": {
      accepts: {
        scheme: "exact",
        price: "$0.005",
        network: "eip155:8453",
        payTo: WALLET,
      },
      description: "Statistical simulation and random generation",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          info: {
            title: "OOM Data API",
            description: "Pay-per-call endpoint via x402"
          },
          schema: staticDataSchema
        }
      }
    },
  },
  resourceServer
);

module.exports = { baseX402Middleware };
