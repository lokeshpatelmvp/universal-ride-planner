import requests
import re
import json
from datetime import datetime
import os
from bs4 import BeautifulSoup

def extract_today_data():
    """Extract today's wait time data and save it in the same format as last week's data"""
    
    print("Extracting Today's Wait Time Data from Thrill Data...")
    print("=" * 60)
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # Fetch the heatmap page for today
        today = datetime.now().strftime('%Y-%m-%d')
        print(f"\nFetching heatmap data for {today}...")
        
        # First, get the main page to extract SVG time labels
        main_page_response = requests.get(
            'https://www.thrill-data.com/waits/graph/quick/parkheat',
            params={
                'id': 243,  # Epic Universe park ID
                'dateStart': today,
                'tag': 'min'
            },
            headers=headers
        )
        main_page_response.raise_for_status()
        
        # Parse the HTML to extract time labels from SVG
        soup = BeautifulSoup(main_page_response.text, 'html.parser')
        
        # Find the SVG element with time labels (using the XPath you provided)
        # The XPath /html/body/div[2]/div[19]/div[2]/div[33]/div/div/div/div/svg[1]/g[4]/g/g[12] 
        # corresponds to the time axis labels
        svg_elements = soup.find_all('svg')
        time_labels = []
        
        if svg_elements:
            # Look for text elements that contain time labels
            for svg in svg_elements:
                text_elements = svg.find_all('text')
                for text in text_elements:
                    text_content = text.get_text().strip()
                    # Look for time patterns like "8:45 AM", "9:00 AM", etc.
                    if re.match(r'\d{1,2}:\d{2}\s*(AM|PM)', text_content):
                        time_labels.append(text_content)
        
        print(f"Extracted {len(time_labels)} time labels from SVG: {time_labels[:5]}...")
        
        # If we couldn't get time labels from SVG, fall back to the original method
        if not time_labels:
            print("Could not extract time labels from SVG, falling back to Plotly data...")
            
            # Parse the JSON response
            data = json.loads(main_page_response.text)
            plot1_content = data['plot1']
            
            # Extract the Plotly data using a more robust approach
            plotly_pattern = r'Plotly\.newPlot\([^,]+,\s*(\[.*?\]),\s*\{'
            plotly_match = re.search(plotly_pattern, plot1_content, re.DOTALL)
            
            if not plotly_match:
                print("No Plotly data found")
                return
            
            data_str = plotly_match.group(1)
            
            # Extract x array (time labels)
            x_pattern = r'"x":\s*\[([^\]]*)\]'
            x_match = re.search(x_pattern, data_str)
            if not x_match:
                print("Could not extract x array")
                return
            
            x_content = '[' + x_match.group(1) + ']'
            x_content = re.sub(r"'([^']*)'", r'"\1"', x_content)
            x_content = re.sub(r'\\u003cbr\\u003e', '<br>', x_content)
            
            try:
                time_labels = json.loads(x_content)
                print(f"Extracted {len(time_labels)} time labels from Plotly data")
            except json.JSONDecodeError as e:
                print(f"Error parsing x array: {e}")
                return
        else:
            # We got time labels from SVG, now get the wait time data
            data = json.loads(main_page_response.text)
            plot1_content = data['plot1']
            
            # Extract the Plotly data for wait times
            plotly_pattern = r'Plotly\.newPlot\([^,]+,\s*(\[.*?\]),\s*\{'
            plotly_match = re.search(plotly_pattern, plot1_content, re.DOTALL)
            
            if not plotly_match:
                print("No Plotly data found")
                return
            
            data_str = plotly_match.group(1)
        
        print(f"Extracted data string length: {len(data_str)} characters")
        
        # Extract y array (ride names)
        y_pattern = r'"y":\s*\[([^\]]*)\]'
        y_match = re.search(y_pattern, data_str)
        if not y_match:
            print("Could not extract y array")
            return
        
        y_content = '[' + y_match.group(1) + ']'
        # Clean up the y array content
        y_content = re.sub(r"'([^']*)'", r'"\1"', y_content)
        y_content = re.sub(r'\\u003cbr\\u003e', '<br>', y_content)
        
        # Replace all occurrences of '"s' with ''s'
        y_content = y_content.replace('"s', "'s")
        # Replace all remaining double quotes not at array boundaries with apostrophes
        y_content = re.sub(r'(?<![\[,])"(?![\],])', "'", y_content)
        # Now replace only the array delimiter single quotes with double quotes for valid JSON
        y_content = re.sub(r'(?<=[\[,])"', '"', y_content)  # Start of items
        y_content = re.sub(r'"(?=[,\]])', '"', y_content)   # End of items
        
        try:
            y_data = json.loads(y_content)
            print(f"Successfully parsed y array with {len(y_data)} rides")
        except json.JSONDecodeError as e:
            print(f"Error parsing y array: {e}")
            return
        
        # Extract z array (wait times matrix)
        z_pattern = r'"z":\s*(\[\[.*?\]\])'
        z_match = re.search(z_pattern, data_str, re.DOTALL)
        if not z_match:
            print("Could not extract z array")
            return
        
        z_content = z_match.group(1)
        z_content = re.sub(r"'([^']*)'", r'"\1"', z_content)
        z_content = re.sub(r'\\u003cbr\\u003e', '<br>', z_content)
        z_content = z_content.replace("'", '"')
        
        try:
            z_data = json.loads(z_content)
            print(f"Successfully parsed z array with {len(z_data)} rows")
        except json.JSONDecodeError as e:
            print(f"Error parsing z array: {e}")
            return
        
        print(f"\nData Summary:")
        print(f"Time intervals: {len(time_labels)}")
        print(f"Rides: {len(y_data)}")
        print(f"Wait time data rows: {len(z_data)}")
        
        # Process the data into the same format as last week's data
        rides = []
        
        # Filter out the "Average" time point and get its index
        average_index = -1
        if "Average" in time_labels:
            average_index = time_labels.index("Average")
        
        filtered_time_labels = [time for time in time_labels if time != "Average"]
        
        for i, ride_name in enumerate(y_data):
            if i < len(z_data) and z_data[i]:
                wait_times = z_data[i]
                
                # If average existed, slice the array to match filtered time points
                if average_index != -1 and len(wait_times) > average_index:
                    wait_times = wait_times[:average_index]
                
                # Convert empty strings to null and process wait times
                processed_times = []
                for wt in wait_times:
                    if wt == '' or wt is None:
                        processed_times.append(None)
                    else:
                        try:
                            processed_times.append(int(wt))
                        except:
                            processed_times.append(None)
                
                # Get the latest non-null wait time for current status
                current_wait = None
                for wt in reversed(processed_times):
                    if wt is not None:
                        current_wait = wt
                        break
                
                # Create wait_times array in the expected format (without Average)
                wait_times_formatted = []
                for j, time_label in enumerate(filtered_time_labels):
                    wait_times_formatted.append({
                        "time": time_label,
                        "wait": processed_times[j] if j < len(processed_times) else None
                    })
                
                rides.append({
                    "name": ride_name,
                    "waitTime": current_wait,
                    "status": "Open" if current_wait is not None else "Down",
                    "wait_times": wait_times_formatted
                })
        
        # Create the final data structure
        today_data = {
            "date": today,
            "park": "Epic Universe",
            "rides": rides
        }
        
        # Save to file
        output_file = f"data/today_waits_{today}.json"
        os.makedirs("data", exist_ok=True)
        
        with open(output_file, 'w') as f:
            json.dump(today_data, f, indent=2)
        
        print(f"Successfully saved today's data to {output_file}")
        print(f"Processed {len(rides)} rides with wait time data")
        
        # Print sample data for verification
        print("Sample ride data:")
        for ride in rides[:3]:
            data_points = len([wt for wt in ride['wait_times'] if wt['wait'] is not None])
            print(f"  {ride['name']}: {ride['waitTime']} min (current), {data_points} data points")
        
        print("Data refresh completed successfully")
        
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise

if __name__ == "__main__":
    extract_today_data() 