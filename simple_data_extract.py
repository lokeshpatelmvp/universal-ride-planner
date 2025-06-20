import requests
import re
from datetime import datetime, timedelta

def extract_simple_data():
    """Extract wait time data from the 'text' field in Plotly data"""
    
    print("🔍 Extracting Simple Wait Time Data...")
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
        
        # Extract the text data directly using regex
        text_pattern = r'"text":\[\[(.*?)\]\]'
        text_match = re.search(text_pattern, page_content, re.DOTALL)
        
        if not text_match:
            print("❌ No text data found")
            return
        
        print("✅ Found text data!")
        
        # Extract the text content
        text_content = text_match.group(1)
        
        # Split into individual ride data
        ride_data_pattern = r'\[(.*?)\]'
        ride_matches = re.findall(ride_data_pattern, text_content)
        
        print(f"\n📊 Found {len(ride_matches)} rides")
        
        # Look for our target rides
        target_rides = ['Yoshi', 'Carousel', 'Mario']
        
        # First, let's see what rides we have
        print("\n🎢 All Available Rides:")
        for i, ride_data in enumerate(ride_matches[:10]):  # Show first 10
            # Extract first few values to identify the ride
            values = re.findall(r'"([^"]*)"', ride_data)
            non_empty_values = [v for v in values if v.strip()]
            if non_empty_values:
                print(f"  Ride {i+1}: {non_empty_values[:5]}...")
        
        # Now let's look for our specific rides
        print(f"\n🎯 Looking for target rides: {target_rides}")
        
        for i, ride_data in enumerate(ride_matches):
            # Extract all values for this ride
            values = re.findall(r'"([^"]*)"', ride_data)
            
            # Convert to integers, empty strings become None
            wait_times = []
            for v in values:
                if v.strip() == '':
                    wait_times.append(None)
                else:
                    try:
                        wait_times.append(int(v))
                    except:
                        wait_times.append(None)
            
            # Check if this ride has any non-null values
            non_null_count = sum(1 for wt in wait_times if wt is not None)
            
            if non_null_count > 0:
                # Try to identify the ride by looking at the pattern
                # This is a heuristic - we'll look for patterns that match our expectations
                
                # Check if this might be one of our target rides
                is_target = False
                ride_name = f"Ride {i+1}"
                
                # Yoshi pattern: starts with low values, increases
                if (wait_times[:5] and all(wt is not None and wt < 30 for wt in wait_times[:5] if wt is not None)):
                    ride_name = "Yoshi's Adventure"
                    is_target = True
                
                # Carousel pattern: mostly nulls or low values
                elif (sum(1 for wt in wait_times if wt is not None) < 20):
                    ride_name = "Constellation Carousel"
                    is_target = True
                
                # Mario pattern: high values (100+)
                elif (any(wt is not None and wt > 100 for wt in wait_times)):
                    ride_name = "Mario Kart: Bowser's Challenge"
                    is_target = True
                
                if is_target:
                    print(f"\n🎢 {ride_name}:")
                    print(f"  First 10: {wait_times[:10]}")
                    print(f"  Last 10:  {wait_times[-10:]}")
                    print(f"  Total data points: {len(wait_times)}")
                    print(f"  Non-null values: {non_null_count}")
                    print(f"  Null values: {len(wait_times) - non_null_count}")
                    
                    # Show statistics
                    non_null_times = [wt for wt in wait_times if wt is not None]
                    if non_null_times:
                        print(f"  Min wait time: {min(non_null_times)} minutes")
                        print(f"  Max wait time: {max(non_null_times)} minutes")
                        print(f"  Average wait time: {sum(non_null_times) / len(non_null_times):.1f} minutes")
        
        # Also show all rides with their data for comparison
        print(f"\n📋 All Rides Data (first 10 values each):")
        for i, ride_data in enumerate(ride_matches):
            values = re.findall(r'"([^"]*)"', ride_data)
            wait_times = []
            for v in values:
                if v.strip() == '':
                    wait_times.append(None)
                else:
                    try:
                        wait_times.append(int(v))
                    except:
                        wait_times.append(None)
            
            non_null_count = sum(1 for wt in wait_times if wt is not None)
            if non_null_count > 0:
                print(f"  Ride {i+1}: {wait_times[:10]} (non-null: {non_null_count})")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching data: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    extract_simple_data() 