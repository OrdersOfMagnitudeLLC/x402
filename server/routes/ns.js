const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const router = express.Router();

// Binary paths
const NS_COMP_SERVER = '/home/lumiere/NS/NSComp/nscomp_server';
const NS_FIX_SERVER = '/home/lumiere/NS/NSFix/nsfix_server';
const NS_HASH_SERVER = '/home/lumiere/NS/NSHash/nshash_server';
const NS_INDEX_SERVER = '/home/lumiere/NS/NSIndex/nsindex_server';
const NS_MATRIX_SERVER = '/home/lumiere/NS/NSMatrix/nsmatrix_server';
const NS_CACHE_SERVER = '/home/lumiere/NS/NSCache/nscache_server';

// Helper function to spawn server process
async function callServer(binaryPath, inputData) {
    return new Promise((resolve, reject) => {
        const child = spawn(binaryPath, []);
        let stdout = '';
        let stderr = '';

        child.stdin.write(JSON.stringify(inputData));
        child.stdin.end();

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Process exited with code ${code}: ${stderr}`));
            } else {
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (e) {
                    reject(new Error(`Failed to parse output: ${stdout}`));
                }
            }
        });
    });
}

// NSComp endpoints
router.post('/compress', async (req, res) => {
    try {
        const { schema, data, n_records } = req.body;
        const result = await callServer(NS_COMP_SERVER, {
            action: 'compress',
            schema,
            data,
            n_records
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/decompress', async (req, res) => {
    try {
        const { schema, data, n_records } = req.body;
        const result = await callServer(NS_COMP_SERVER, {
            action: 'decompress',
            schema,
            data,
            n_records
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NSFix endpoints
router.post('/parse', async (req, res) => {
    try {
        const { message, sender, target } = req.body;
        const result = await callServer(NS_FIX_SERVER, {
            action: 'parse',
            message,
            sender: sender || 'SENDER',
            target: target || 'TARGET'
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/batch', async (req, res) => {
    try {
        const { messages, sender, target } = req.body;
        const result = await callServer(NS_FIX_SERVER, {
            action: 'batch',
            messages,
            sender: sender || 'SENDER',
            target: target || 'TARGET'
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/validate', async (req, res) => {
    try {
        const { message } = req.body;
        const result = await callServer(NS_FIX_SERVER, {
            action: 'validate',
            message
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NSHash endpoints
router.post('/dedup', async (req, res) => {
    try {
        const { items } = req.body;
        const result = await callServer(NS_HASH_SERVER, {
            action: 'dedup',
            items
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/stream-dedup', async (req, res) => {
    try {
        const { items } = req.body;
        const result = await callServer(NS_HASH_SERVER, {
            action: 'stream-dedup',
            items
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NSIndex endpoints
router.post('/index/build', async (req, res) => {
    try {
        const { data } = req.body;
        const result = await callServer(NS_INDEX_SERVER, {
            action: 'build',
            data
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/index/query', async (req, res) => {
    try {
        const { key } = req.body;
        const result = await callServer(NS_INDEX_SERVER, {
            action: 'query',
            key
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/index/range', async (req, res) => {
    try {
        const { lo, hi, max_out } = req.body;
        const result = await callServer(NS_INDEX_SERVER, {
            action: 'range',
            lo,
            hi,
            max_out: max_out || 1000
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NSMatrix endpoints
router.post('/matrix', async (req, res) => {
    try {
        const { matrix_a, matrix_b } = req.body;
        const result = await callServer(NS_MATRIX_SERVER, {
            action: 'multiply',
            matrix_a,
            matrix_b
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NSCache endpoints
router.post('/cache', async (req, res) => {
    try {
        const { key, value } = req.body;
        const result = await callServer(NS_CACHE_SERVER, {
            action: 'lookup',
            key,
            value
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
