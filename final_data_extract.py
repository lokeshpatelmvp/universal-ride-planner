import requests
import re
import json
from datetime import datetime, timedelta

def extract_final_data():
    """Extract the real wait time data for the three specific rides"""
    
    print("🔍 Extracting Real Wait Time Data from Thrill Data...")
    print("=" * 60)
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # Fetch the heatmap page
        print("\n📊 Fetching heatmap data...")
        
        heat_map_response = requests.get(
            'https://www.thrill-data.com/waits/graph/quick/parkheat',
            params={
                'id': 243,  # Epic Universe park ID
                'dateStart': (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'),
                'tag': 'min'
            },
            headers=headers
        )
        heat_map_response.raise_for_status()
        
        page_content = heat_map_response.text
        
        # Parse the JSON response
        data = json.loads(page_content)
        plot1_content = data['plot1']
        
        # Extract the Plotly data
        plotly_pattern = r'Plotly\.newPlot\([^,]+,\s*(\[.*?\]),\s*\{'
        plotly_match = re.search(plotly_pattern, plot1_content, re.DOTALL)
        
        if not plotly_match:
            print("❌ No Plotly data found")
            return
        
        # Clean up the JavaScript data for JSON parsing
        data_str = plotly_match.group(1)
        
        # Replace JavaScript syntax with JSON syntax
        data_str = re.sub(r'([a-zA-Z_][a-zA-Z0-9_]*):', r'"\1":', data_str)
        data_str = re.sub(r"'([^']*)'", r'"\1"', data_str)
        data_str = re.sub(r'\\u003c', '<', data_str)
        data_str = re.sub(r'\\u003e', '>', data_str)
        data_str = re.sub(r'\\u003d', '=', data_str)
        data_str = re.sub(r'\\u002f', '/', data_str)
        data_str = re.sub(r'\\u003cbr\\u003e', '<br>', data_str)
        
        try:
            # Parse the JSON data
            plotly_data = json.loads(data_str)
            
            if not plotly_data or len(plotly_data) == 0:
                print("❌ No data in Plotly array")
                return
            
            # Extract the main data object
            data_obj = plotly_data[0]
            
            # Extract the key data arrays
            z_data = data_obj.get('z', [])  # Wait time data (2D array)
            y_data = data_obj.get('y', [])  # Ride names (1D array)
            x_data = data_obj.get('x', [])  # Time points (1D array)
            
            print(f"\n📊 Data Summary:")
            print(f"Time intervals: {len(x_data)} (every 15 minutes)")
            print(f"Rides: {len(y_data)}")
            print(f"Wait time data rows: {len(z_data)}")
            
            print(f"\n⏰ Time Intervals:")
            for i, time in enumerate(x_data):
                print(f"  {i:2d}: {time}")
            
            print(f"\n🎢 Available Rides:")
            for i, ride_name in enumerate(y_data):
                print(f"  {i:2d}: {ride_name}")
            
            # Find our target rides
            target_rides = ['Yoshi', 'Carousel', 'Mario']
            found_targets = []
            
            for i, ride_name in enumerate(y_data):
                if any(target in ride_name for target in target_rides):
                    found_targets.append((i, ride_name))
            
            print(f"\n🎯 Target Rides Found:")
            for idx, ride_name in found_targets:
                print(f"\n{ride_name} (index {idx}):")
                
                if idx < len(z_data) and z_data[idx]:
                    wait_times = z_data[idx]
                    
                    # Convert empty strings to null
                    processed_times = []
                    for wt in wait_times:
                        if wt == '' or wt is None:
                            processed_times.append(None)
                        else:
                            try:
                                processed_times.append(int(wt))
                            except:
                                processed_times.append(None)
                    
                    # Show first 10 and last 10 data points
                    first_10 = processed_times[:10]
                    last_10 = processed_times[-10:] if len(processed_times) >= 10 else processed_times
                    
                    print(f"  First 10: {first_10}")
                    print(f"  Last 10:  {last_10}")
                    print(f"  Total data points: {len(processed_times)}")
                    
                    # Count nulls and non-nulls
                    null_count = sum(1 for wt in processed_times if wt is None)
                    non_null_count = len(processed_times) - null_count
                    print(f"  Non-null values: {non_null_count}")
                    print(f"  Null values: {null_count}")
                    
                    # Show some statistics
                    non_null_times = [wt for wt in processed_times if wt is not None]
                    if non_null_times:
                        print(f"  Min wait time: {min(non_null_times)} minutes")
                        print(f"  Max wait time: {max(non_null_times)} minutes")
                        print(f"  Average wait time: {sum(non_null_times) / len(non_null_times):.1f} minutes")
                else:
                    print("  No wait time data available")
            
            # Show all rides data for comparison
            print(f"\n📋 All Rides Data Summary:")
            for i, ride_name in enumerate(y_data):
                if i < len(z_data) and z_data[i]:
                    wait_times = z_data[i]
                    processed_times = []
                    for wt in wait_times:
                        if wt == '' or wt is None:
                            processed_times.append(None)
                        else:
                            try:
                                processed_times.append(int(wt))
                            except:
                                processed_times.append(None)
                    
                    non_null_count = sum(1 for wt in processed_times if wt is not None)
                    if non_null_count > 0:
                        non_null_times = [wt for wt in processed_times if wt is not None]
                        avg_wait = sum(non_null_times) / len(non_null_times)
                        print(f"  {i:2d}: {ride_name:30} | Non-null: {non_null_count:2d} | Avg: {avg_wait:5.1f} min | First 5: {processed_times[:5]}")
            
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing JSON: {e}")
            print("Raw data preview:")
            print(data_str[:1000] + "...")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching data: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    extract_final_data() 