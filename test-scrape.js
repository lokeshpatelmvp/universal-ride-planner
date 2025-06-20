const axios = require('axios');
const cheerio = require('cheerio');

async function testScrape() {
    try {
        console.log('Fetching Epic Universe Wait Time Heat Map data...');
        
        // First get current wait times
        const response = await axios.get('https://www.thrill-data.com/waits/park/uor/epic-universe/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);
        
        console.log('\nCurrent Wait Times:');
        console.log('--------------------------------');
        
        // Get current wait times
        $('table').each((i, table) => {
            const tableText = $(table).text();
            if (tableText.includes('ATTRACTION') && tableText.includes('REQ')) {
                $(table).find('tr').each((j, row) => {
                    const cells = $(row).find('td');
                    if (cells.length >= 4) {
                        const attraction = $(cells[0]).text().trim();
                        const heightReq = $(cells[1]).text().trim();
                        const waitTime = $(cells[3]).text().trim();
                        
                        if (attraction && waitTime) {
                            console.log(`\nAttraction: ${attraction}`);
                            console.log(`Height Requirement: ${heightReq}`);
                            console.log(`Current Wait Time: ${waitTime}`);
                        }
                    }
                });
            }
        });

        // Now get heat map data
        console.log('\nFetching Heat Map Data...');
        const heatMapResponse = await axios.get('https://www.thrill-data.com/waits/graph/quick/parkheat', {
            params: {
                id: 243,  // Epic Universe park ID
                dateStart: '2025-06-17',
                tag: 'min'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // Extract the Plotly.newPlot data array
        const plotData = heatMapResponse.data.plot1;
        const dataArrayMatch = plotData.match(/Plotly\.newPlot\([^,]+,\s*(\[.*?\]),\s*\{/s);
        if (!dataArrayMatch) {
            throw new Error('Could not extract Plotly data array');
        }
        // Use eval in a safe context to parse the JS array
        let dataArr;
        try {
            dataArr = eval(dataArrayMatch[1]);
        } catch (e) {
            throw new Error('Failed to eval Plotly data array: ' + e.message);
        }
        const data = dataArr[0];
        const z = data.z;
        const y = data.y;
        const x = data.x;

        console.log('\nWait Time Data for Sparklines:');
        console.log('--------------------------------');
        y.forEach((rideName, i) => {
            if (i < z.length) {
                const waitTimes = z[i].map(wt => wt === '' ? null : parseInt(wt)).filter(wt => wt !== null);
                if (waitTimes.length > 0) {
                    console.log(`\nRide: ${rideName}`);
                    console.log('Time Points:', x.join(', '));
                    console.log('Wait Times:', waitTimes.join(', '));
                    console.log('--------------------------------');
                }
            }
        });

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testScrape(); 