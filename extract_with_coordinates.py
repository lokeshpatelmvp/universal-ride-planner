import requests
import re
import json
import os
from datetime import datetime, timedelta

def extract_with_coordinates():
    """Extract wait time data with proper time coordinates from Plotly heatmap"""
    
    print("🔍 Extracting Wait Times with Time Coordinates from Plotly...")
    print("=" * 60)
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    # Calculate dates
    today = datetime.now()
    week_ago = today - timedelta(days=7)
    
    print(f"📅 Dates:")
    print(f"  Today: {today.strftime('%Y-%m-%d')}")
    print(f"  Last Week: {week_ago.strftime('%Y-%m-%d')}")
    
    try:
        # Fetch the heatmap data
        print(f"\n📊 Fetching heatmap data...")
        heat_map_response = requests.get(
            'https://www.thrill-data.com/waits/graph/quick/parkheat',
            params={
                'id': 243,  # Epic Universe park ID
                'dateStart': week_ago.strftime('%Y-%m-%d'),
                'dateEnd': week_ago.strftime('%Y-%m-%d'),
                'tag': 'min'
            },
            headers=headers
        )
        heat_map_response.raise_for_status()
        data = heat_map_response.json()
        plot1_content = data['plot1']
        
        print("✅ Heatmap data loaded successfully")
        
        # Extract the Plotly data
        plotly_pattern = r'Plotly\.newPlot\([^,]+,\s*(\[.*?\]),\s*\{'
        plotly_match = re.search(plotly_pattern, plot1_content, re.DOTALL)
        
        if not plotly_match:
            print("❌ No Plotly data found")
            return
        
        data_str = plotly_match.group(1)
        
        # Write the first 2000 characters of data_str for inspection
        with open('data/plotly_data_str.txt', 'w', encoding='utf-8') as f:
            f.write(data_str[:2000])
        print("First 2000 chars of data_str written to data/plotly_data_str.txt")
        
        # Extract the x coordinates (time points)
        x_pattern = r'"x":\s*\[(.*?)\]'
        x_match = re.search(x_pattern, data_str, re.DOTALL)
        
        if not x_match:
            print("❌ No x coordinates (time points) found")
            return
        
        x_str = x_match.group(1)
        # Parse the time coordinates
        time_coordinates = []
        time_matches = re.findall(r'"([^"]*)"', x_str)
        for time_str in time_matches:
            if time_str != 'Average':  # Skip the average column
                time_coordinates.append(time_str)
        
        print(f"\n⏰ Time Coordinates ({len(time_coordinates)} intervals):")
        print("-" * 50)
        for i, time in enumerate(time_coordinates):
            print(f"  {i:2d}: {time}")
        
        # Extract the y coordinates (ride names)
        y_pattern = r'"y":\s*\[(.*?)\]'
        y_match = re.search(y_pattern, data_str, re.DOTALL)
        
        if not y_match:
            print("❌ No y coordinates (ride names) found")
            return
        
        y_str = y_match.group(1)
        ride_names = []
        ride_matches = re.findall(r'"([^"]*)"', y_str)
        for ride_str in ride_matches:
            if ride_str != 'Average':  # Skip the average row
                ride_names.append(ride_str)
        
        print(f"\n🎢 Ride Names ({len(ride_names)} rides):")
        print("-" * 50)
        for i, ride in enumerate(ride_names):
            print(f"  {i:2d}: {ride}")
        
        # Parse data_str as JSON array
        try:
            plotly_data = json.loads(data_str)
            if isinstance(plotly_data, list) and len(plotly_data) > 0 and 'text' in plotly_data[0]:
                wait_time_arrays = plotly_data[0]['text']
                print(f"✅ Extracted wait_time_arrays from 'text' key. Arrays: {len(wait_time_arrays)}")
            else:
                print("❌ 'text' key not found in parsed Plotly data.")
                wait_time_arrays = []
        except Exception as e:
            print(f"❌ Failed to parse data_str as JSON: {e}")
            wait_time_arrays = []
        
        print(f"\n📊 Wait Time Data Structure:")
        print("-" * 50)
        print(f"  Number of rides: {len(ride_names)}")
        print(f"  Number of time intervals: {len(time_coordinates)}")
        print(f"  Number of wait time arrays: {len(wait_time_arrays)}")
        
        # Show first few arrays for debugging
        for i, array in enumerate(wait_time_arrays[:3]):
            print(f"  Array {i}: {array[:10]}... (length: {len(array)})")
        
        # Create the JSON structure
        rides_data = []
        
        for i, ride_name in enumerate(ride_names):
            if i < len(wait_time_arrays):
                wait_times = wait_time_arrays[i]
                # Convert wait times to int or None
                clean_wait_times = []
                for v in wait_times[:len(time_coordinates)]:
                    if v == '' or v is None:
                        clean_wait_times.append(None)
                    else:
                        try:
                            clean_wait_times.append(int(v))
                        except:
                            clean_wait_times.append(None)
                # Create time-wait mapping for this ride
                time_wait_mapping = []
                for j, time in enumerate(time_coordinates):
                    if j < len(clean_wait_times):
                        wait_time = clean_wait_times[j]
                        time_wait_mapping.append({
                            "time": time,
                            "wait": wait_time
                        })
                rides_data.append({
                    "name": ride_name,
                    "wait_times": time_wait_mapping
                })
        
        # Create the final JSON structure
        json_data = {
            "date": week_ago.strftime('%Y-%m-%d'),
            "park": "Epic Universe",
            "rides": rides_data
        }
        
        # Create data directory if it doesn't exist
        os.makedirs('data', exist_ok=True)
        
        # Save to JSON file
        json_filename = f"data/last_week_waits_{week_ago.strftime('%Y-%m-%d')}.json"
        with open(json_filename, 'w') as f:
            json.dump(json_data, f, indent=2)
        
        print(f"\n✅ JSON data saved to: {json_filename}")
        print(f"📊 Total rides processed: {len(rides_data)}")
        
        # Show sample data for first few rides
        print(f"\n📋 Sample Data:")
        print("-" * 50)
        for i, ride in enumerate(rides_data[:3]):
            print(f"\n{ride['name']}:")
            print(f"  Time intervals: {len(ride['wait_times'])}")
            non_null_times = [wt['wait'] for wt in ride['wait_times'] if wt['wait'] is not None]
            if non_null_times:
                print(f"  Non-null wait times: {len(non_null_times)}")
                print(f"  Average wait: {sum(non_null_times) / len(non_null_times):.1f} minutes")
                print(f"  Sample times: {ride['wait_times'][:5]}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    extract_with_coordinates() 