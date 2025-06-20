import requests
import re
from datetime import datetime, timedelta

def extract_real_data():
    """Extract real wait times from Thrill Data using actual park hours"""
    
    print("🔍 Extracting Real Wait Times from Thrill Data...")
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
    
    # Park hours from the page
    park_open = "10:00 AM"
    park_close = "09:00 PM"
    
    print(f"🏰 Park Hours: {park_open} to {park_close}")
    
    try:
        # 1. Get today's current wait times
        print(f"\n📊 Fetching today's current wait times...")
        today_url = f"https://www.thrill-data.com/waits/park/uor/epic-universe/{today.strftime('%Y/%m/%d')}"
        
        today_response = requests.get(today_url, headers=headers)
        today_response.raise_for_status()
        today_content = today_response.text
        
        print(f"✅ Today's page loaded: {today_url}")
        
        # Extract current wait times from the attractions table
        attractions_pattern = r'<tr[^>]*>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>'
        attractions = re.findall(attractions_pattern, today_content, re.IGNORECASE)
        
        print(f"\n🎢 Today's Current Wait Times:")
        print("-" * 50)
        
        target_rides = ['Yoshi', 'Carousel', 'Mario', 'Mine-Cart', 'Monsters']
        found_today = {}
        
        for attraction in attractions:
            name = attraction[0].strip()
            height_req = attraction[1].strip()
            wait_time = attraction[3].strip()
            
            if any(target in name for target in target_rides):
                found_today[name] = {
                    'height_req': height_req,
                    'wait_time': wait_time
                }
                print(f"  {name:40} | Height: {height_req:8} | Wait: {wait_time}")
        
        # 2. Get last week's data from the same page structure
        print(f"\n📈 Fetching last week's data...")
        week_url = f"https://www.thrill-data.com/waits/park/uor/epic-universe/{week_ago.strftime('%Y/%m/%d')}"
        
        week_response = requests.get(week_url, headers=headers)
        week_response.raise_for_status()
        week_content = week_response.text
        
        print(f"✅ Last week's page loaded: {week_url}")
        
        # Extract last week's wait times
        week_attractions = re.findall(attractions_pattern, week_content, re.IGNORECASE)
        
        print(f"\n📊 Last Week's Wait Times:")
        print("-" * 50)
        
        found_week = {}
        
        for attraction in week_attractions:
            name = attraction[0].strip()
            height_req = attraction[1].strip()
            wait_time = attraction[3].strip()
            
            if any(target in name for target in target_rides):
                found_week[name] = {
                    'height_req': height_req,
                    'wait_time': wait_time
                }
                print(f"  {name:40} | Height: {height_req:8} | Wait: {wait_time}")
        
        # 3. Extract typical wait times table
        print(f"\n⏰ Typical Average Wait Times (from today's page):")
        print("-" * 50)
        
        # Look for the typical wait times table
        typical_pattern = r'(\d{1,2}:\d{2}\s*[AP]M)\s*\|\s*(\d+)\s*minutes'
        typical_times = re.findall(typical_pattern, today_content)
        
        if typical_times:
            print("  Time     | Wait Time")
            print("  ---------|----------")
            for time, wait in typical_times[:20]:  # Show first 20
                print(f"  {time:9} | {wait} minutes")
            print(f"  ... (showing first 20 of {len(typical_times)} intervals)")
        else:
            print("  No typical wait times found")
        
        # 4. Extract park average
        print(f"\n📊 Park Averages:")
        print("-" * 30)
        
        # Look for current average
        current_avg_pattern = r'Current Average:\s*<strong>(\d+)</strong>'
        current_match = re.search(current_avg_pattern, today_content)
        if current_match:
            current_avg = current_match.group(1)
            print(f"  Current Average: {current_avg} minutes")
        
        # Look for today's average
        today_avg_pattern = r"(\d{2}/\d{2}/\d{4})'s Average:\s*<strong>(\d+)</strong>"
        today_match = re.search(today_avg_pattern, today_content)
        if today_match:
            date = today_match.group(1)
            avg = today_match.group(2)
            print(f"  {date}'s Average: {avg} minutes")
        
        # 5. Summary
        print(f"\n📋 Summary:")
        print("-" * 30)
        print(f"  Today's rides found: {len(found_today)}")
        print(f"  Last week's rides found: {len(found_week)}")
        print(f"  Typical intervals: {len(typical_times)}")
        
        # 6. Show specific ride comparison
        print(f"\n🎯 Target Ride Comparison:")
        print("-" * 40)
        
        for ride_name in ['Yoshi\'s Adventure', 'Constellation Carousel', 'Mario Kart: Bowser\'s Challenge']:
            today_data = found_today.get(ride_name, {})
            week_data = found_week.get(ride_name, {})
            
            print(f"  {ride_name}:")
            print(f"    Today: {today_data.get('wait_time', 'N/A')} min")
            print(f"    Last Week: {week_data.get('wait_time', 'N/A')} min")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    extract_real_data() 