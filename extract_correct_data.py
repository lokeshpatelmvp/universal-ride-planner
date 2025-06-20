import requests
import re
import json
from datetime import datetime, timedelta

def extract_correct_data():
    """Extract today's current wait times and last week's data from Thrill Data"""
    
    print("🔍 Extracting Correct Wait Time Data from Thrill Data...")
    print("=" * 60)
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    # Calculate dates
    today = datetime.now()
    today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    
    week_ago = today - timedelta(days=7)
    week_ago_start = week_ago.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago_end = week_ago.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    print(f"📅 Date Ranges:")
    print(f"  Today: {today_start.strftime('%Y-%m-%d')} to {today.strftime('%Y-%m-%d %H:%M')}")
    print(f"  Last Week: {week_ago_start.strftime('%Y-%m-%d')} to {week_ago_end.strftime('%Y-%m-%d')}")
    
    try:
        # 1. Get today's current wait times
        print(f"\n📊 Fetching today's current wait times...")
        today_url = f"https://www.thrill-data.com/waits/park/uor/epic-universe/{today.strftime('%Y/%m/%d')}"
        
        today_response = requests.get(today_url, headers=headers)
        today_response.raise_for_status()
        
        print(f"✅ Today's page loaded successfully")
        print(f"   URL: {today_url}")
        
        # Look for current wait times in the page
        today_content = today_response.text
        
        # Look for the attractions table
        attractions_pattern = r'<tr[^>]*>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>'
        attractions = re.findall(attractions_pattern, today_content, re.IGNORECASE)
        
        print(f"\n🎢 Today's Current Wait Times:")
        print("-" * 50)
        
        target_rides = ['Yoshi', 'Carousel', 'Mario']
        found_today = []
        
        for attraction in attractions:
            name = attraction[0].strip()
            height_req = attraction[1].strip()
            wait_time = attraction[3].strip()
            
            if any(target in name for target in target_rides):
                found_today.append((name, height_req, wait_time))
                print(f"  {name:30} | Height: {height_req:8} | Wait: {wait_time}")
        
        if not found_today:
            print("  No target rides found in current wait times")
        
        # 2. Get last week's data
        print(f"\n📈 Fetching last week's data...")
        
        # Try different endpoints for historical data
        week_endpoints = [
            f"https://www.thrill-data.com/waits/graph/quick/parkheat?id=243&dateStart={week_ago_start.strftime('%Y-%m-%d')}&dateEnd={week_ago_end.strftime('%Y-%m-%d')}&tag=min",
            f"https://www.thrill-data.com/waits/graph/quick/ride?id=243&dateStart={week_ago_start.strftime('%Y-%m-%d')}&dateEnd={week_ago_end.strftime('%Y-%m-%d')}",
            f"https://www.thrill-data.com/waits/park/uor/epic-universe/{week_ago_start.strftime('%Y/%m/%d')}"
        ]
        
        week_data_found = False
        
        for i, endpoint in enumerate(week_endpoints):
            print(f"  Trying endpoint {i+1}: {endpoint}")
            
            try:
                week_response = requests.get(endpoint, headers=headers)
                week_response.raise_for_status()
                
                if i == 0:  # Heatmap endpoint
                    data = week_response.json()
                    plot1_content = data['plot1']
                    
                    # Extract the 'text' array
                    text_key = '"text":['
                    start = plot1_content.find(text_key)
                    if start != -1:
                        start += len(text_key) - 1
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
                        text_array_str = text_array_str.replace('null', 'None')
                        text_array_str = text_array_str.replace('"', "'")
                        
                        try:
                            text_array = eval(text_array_str)
                            
                            # Ride mapping from SVG order
                            ride_indices = {
                                'Constellation Carousel': 1,
                                'Mario Kart: Bowser\'s Challenge': 7,
                                'Yoshi\'s Adventure': 12
                            }
                            
                            print(f"\n📊 Last Week's Data (from heatmap):")
                            print("-" * 50)
                            
                            for ride, idx in ride_indices.items():
                                if idx < len(text_array):
                                    ride_data = text_array[idx]
                                    wait_times = []
                                    for v in ride_data:
                                        if v == '' or v is None:
                                            wait_times.append(None)
                                        else:
                                            try:
                                                wait_times.append(int(v))
                                            except:
                                                wait_times.append(None)
                                    
                                    non_null = [wt for wt in wait_times if wt is not None]
                                    if non_null:
                                        print(f"  {ride}:")
                                        print(f"    First 10: {wait_times[:10]}")
                                        print(f"    Last 10:  {wait_times[-10:]}")
                                        print(f"    Avg: {sum(non_null)/len(non_null):.1f} min")
                            
                            week_data_found = True
                            break
                            
                        except Exception as e:
                            print(f"    Error parsing heatmap data: {e}")
                
                elif i == 2:  # Weekly page
                    week_content = week_response.text
                    print(f"    Weekly page loaded successfully")
                    
                    # Look for typical wait times table
                    typical_pattern = r'(\d{1,2}:\d{2}\s*[AP]M)\s*\|\s*(\d+)\s*minutes'
                    typical_times = re.findall(typical_pattern, week_content)
                    
                    if typical_times:
                        print(f"\n📊 Last Week's Typical Wait Times (sample):")
                        print("-" * 50)
                        for time, wait in typical_times[:10]:
                            print(f"  {time}: {wait} minutes")
                        week_data_found = True
                        break
                
            except Exception as e:
                print(f"    Error with endpoint {i+1}: {e}")
        
        if not week_data_found:
            print("❌ Could not fetch last week's data from any endpoint")
        
        # 3. Show summary
        print(f"\n📋 Summary:")
        print("-" * 30)
        print(f"  Today's current data: {'✅' if found_today else '❌'}")
        print(f"  Last week's data: {'✅' if week_data_found else '❌'}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    extract_correct_data() 