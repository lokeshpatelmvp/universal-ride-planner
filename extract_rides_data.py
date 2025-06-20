import requests
import re
import json
from datetime import datetime, timedelta

def extract_rides_data():
    print("🔍 Extracting Real Wait Time Data for Key Rides...")
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
        data = heat_map_response.json()
        plot1_content = data['plot1']
        # Directly find the 'text' array in the HTML
        text_key = '"text":['
        start = plot1_content.find(text_key)
        if start == -1:
            print("❌ No 'text' array found in Plotly data")
            return
        start += len(text_key) - 1  # position at the opening [
        bracket_count = 0
        end = start
        for i, c in enumerate(plot1_content[start:], start):
            if c == '[':
                bracket_count += 1
            elif c == ']':
                bracket_count -= 1
                if bracket_count == 0:
                    end = i + 1
                    break
        text_array_str = plot1_content[start:end]
        # Replace JS null with Python None
        text_array_str = text_array_str.replace('null', 'None')
        # Replace double quotes with single quotes for eval
        text_array_str = text_array_str.replace('"', "'")
        # Use eval safely
        try:
            text_array = eval(text_array_str)
        except Exception as e:
            print(f"❌ Error parsing text array: {e}")
            print(text_array_str[:500])
            return
        # Ride mapping from SVG order
        ride_indices = {
            'Constellation Carousel': 1,
            'Mario Kart: Bowser\'s Challenge': 7,
            'Yoshi\'s Adventure': 12
        }
        for ride, idx in ride_indices.items():
            if idx < len(text_array):
                ride_data = text_array[idx]
                # Convert to int or None
                wait_times = []
                for v in ride_data:
                    if v == '' or v is None:
                        wait_times.append(None)
                    else:
                        try:
                            wait_times.append(int(v))
                        except:
                            wait_times.append(None)
                print(f"\n🎢 {ride} (index {idx}):")
                print(f"  First 10: {wait_times[:10]}")
                print(f"  Last 10:  {wait_times[-10:]}")
                print(f"  Total data points: {len(wait_times)}")
                non_null = [wt for wt in wait_times if wt is not None]
                print(f"  Non-null values: {len(non_null)}")
                print(f"  Null values: {len(wait_times) - len(non_null)}")
                if non_null:
                    print(f"  Min: {min(non_null)} | Max: {max(non_null)} | Avg: {sum(non_null)/len(non_null):.1f}")
            else:
                print(f"No data for {ride} (index {idx})")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    extract_rides_data() 