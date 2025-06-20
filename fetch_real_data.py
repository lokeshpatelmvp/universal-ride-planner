import requests
import json
from datetime import datetime, timedelta
import re

def fetch_thrill_data():
    """Fetch real wait time data from Thrill Data for Epic Universe"""
    
    print("🔍 Fetching real wait time data from Thrill Data...")
    print("=" * 60)
    
    # Headers to mimic a real browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # 1. Get current wait times
        print("\n📊 CURRENT WAIT TIMES:")
        print("-" * 40)
        
        current_response = requests.get(
            'https://www.thrill-data.com/waits/park/uor/epic-universe/',
            headers=headers
        )
        current_response.raise_for_status()
        
        # Extract current wait times using regex
        current_data = current_response.text
        
        # Look for the specific rides
        target_rides = ['Yoshi', 'Carousel', 'Mario Kart']
        
        for ride in target_rides:
            # Find the ride in the HTML
            ride_pattern = rf'{ride}[^<]*</td>[^<]*<td[^>]*>([^<]*)</td>[^<]*<td[^>]*>([^<]*)</td>[^<]*<td[^>]*>([^<]*)</td>'
            match = re.search(ride_pattern, current_data, re.IGNORECASE)
            
            if match:
                height_req = match.group(1).strip()
                wait_time = match.group(3).strip()
                print(f"{ride:20} | Height: {height_req:10} | Wait: {wait_time}")
            else:
                print(f"{ride:20} | Height: {'N/A':10} | Wait: {'N/A'}")
        
        # 2. Get historical heat map data
        print("\n📈 HISTORICAL HEAT MAP DATA:")
        print("-" * 40)
        
        # Calculate date range (last 7 days)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        heat_map_response = requests.get(
            'https://www.thrill-data.com/waits/graph/quick/parkheat',
            params={
                'id': 243,  # Epic Universe park ID
                'dateStart': start_date.strftime('%Y-%m-%d'),
                'tag': 'min'
            },
            headers=headers
        )
        heat_map_response.raise_for_status()
        
        # Extract Plotly data from the response
        plot_data = heat_map_response.text
        
        # Look for the Plotly.newPlot data
        plot_match = re.search(r'Plotly\.newPlot\([^,]+,\s*(\[.*?\]),\s*\{', plot_data, re.DOTALL)
        
        if plot_match:
            try:
                # Safely evaluate the JavaScript array
                data_str = plot_match.group(1)
                # Clean up the data string for safer parsing
                data_str = re.sub(r'([a-zA-Z_][a-zA-Z0-9_]*):', r'"\1":', data_str)
                data_str = re.sub(r"'([^']*)'", r'"\1"', data_str)
                
                # Parse the JSON-like structure
                data_array = json.loads(data_str)
                
                if data_array and len(data_array) > 0:
                    data = data_array[0]
                    z = data.get('z', [])  # Wait time data
                    y = data.get('y', [])  # Ride names
                    x = data.get('x', [])  # Time points
                    
                    print(f"Time points: {len(x)} intervals")
                    print(f"Available rides: {len(y)}")
                    
                    # Find our target rides
                    for i, ride_name in enumerate(y):
                        if any(target in ride_name for target in target_rides):
                            print(f"\n🎢 {ride_name}:")
                            if i < len(z) and z[i]:
                                wait_times = z[i]
                                # Show first 10 and last 10 data points
                                first_10 = wait_times[:10]
                                last_10 = wait_times[-10:] if len(wait_times) >= 10 else wait_times
                                
                                print(f"  First 10: {first_10}")
                                print(f"  Last 10:  {last_10}")
                                print(f"  Total data points: {len(wait_times)}")
                                
                                # Count nulls
                                null_count = sum(1 for wt in wait_times if wt == '' or wt is None)
                                print(f"  Null/empty values: {null_count}")
                            else:
                                print("  No data available")
                
            except Exception as e:
                print(f"Error parsing heat map data: {e}")
                print("Raw response preview:")
                print(plot_data[:500] + "...")
        
        # 3. Try to get more detailed historical data
        print("\n🔍 DETAILED HISTORICAL DATA:")
        print("-" * 40)
        
        # Try different endpoints for historical data
        historical_endpoints = [
            'https://www.thrill-data.com/waits/graph/quick/ride',
            'https://www.thrill-data.com/waits/graph/quick/park'
        ]
        
        for endpoint in historical_endpoints:
            print(f"\nTrying endpoint: {endpoint}")
            try:
                hist_response = requests.get(
                    endpoint,
                    params={
                        'id': 243,
                        'dateStart': start_date.strftime('%Y-%m-%d'),
                        'dateEnd': end_date.strftime('%Y-%m-%d')
                    },
                    headers=headers
                )
                hist_response.raise_for_status()
                
                # Look for JSON data in the response
                json_match = re.search(r'\{.*\}', hist_response.text)
                if json_match:
                    try:
                        hist_data = json.loads(json_match.group(0))
                        print(f"Found JSON data: {list(hist_data.keys())}")
                    except:
                        print("Found JSON-like data but couldn't parse")
                
            except Exception as e:
                print(f"Error with {endpoint}: {e}")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching data: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    fetch_thrill_data() 