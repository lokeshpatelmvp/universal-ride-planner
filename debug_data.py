import requests
import re
from datetime import datetime, timedelta

def debug_data():
    """Debug and extract the actual wait time data"""
    
    print("🔍 Debugging Thrill Data Response...")
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
        
        # Save the raw response for debugging
        with open('thrill_data_response.txt', 'w', encoding='utf-8') as f:
            f.write(page_content)
        
        print("✅ Saved raw response to thrill_data_response.txt")
        
        # Look for the text data with a more flexible pattern
        print("\n🔍 Looking for text data...")
        
        # Try different patterns
        patterns = [
            r'"text":\[\[(.*?)\]\]',
            r'"text":\s*\[\[(.*?)\]\]',
            r'text":\s*\[\[(.*?)\]\]',
            r'text":\[\[(.*?)\]\]'
        ]
        
        for i, pattern in enumerate(patterns):
            print(f"Trying pattern {i+1}: {pattern}")
            match = re.search(pattern, page_content, re.DOTALL)
            if match:
                print(f"✅ Pattern {i+1} found data!")
                text_content = match.group(1)
                print(f"Text content length: {len(text_content)}")
                print(f"First 200 chars: {text_content[:200]}")
                break
        else:
            print("❌ No text data found with any pattern")
            
            # Look for any data that might contain wait times
            print("\n🔍 Looking for any wait time data...")
            
            # Look for arrays of numbers
            number_pattern = r'\["(\d+)"(?:,"(\d+)")*\]'
            number_matches = re.findall(number_pattern, page_content)
            
            if number_matches:
                print(f"Found {len(number_matches)} potential number arrays")
                for j, match in enumerate(number_matches[:5]):
                    numbers = [match[0]] + list(match[1:])
                    print(f"  Array {j+1}: {numbers[:10]}...")
            
            # Look for the specific data we saw in the previous output
            specific_pattern = r'\["5","5","5","5","5","5","5","5","5","5","5","5","5","9","10"'
            specific_match = re.search(specific_pattern, page_content)
            if specific_match:
                print("✅ Found the specific data pattern!")
                start_pos = specific_match.start()
                # Extract a larger chunk around this data
                chunk = page_content[start_pos:start_pos+2000]
                print(f"Data chunk: {chunk}")
        
        # Also look for the Plotly data structure
        print("\n🔍 Looking for Plotly data structure...")
        
        plotly_pattern = r'Plotly\.newPlot\([^,]+,\s*(\[.*?\]),\s*\{'
        plotly_match = re.search(plotly_pattern, page_content, re.DOTALL)
        
        if plotly_match:
            print("✅ Found Plotly data!")
            plotly_data = plotly_match.group(1)
            print(f"Plotly data length: {len(plotly_data)}")
            
            # Look for the text field in the Plotly data
            text_in_plotly = re.search(r'"text":\s*\[\[(.*?)\]\]', plotly_data, re.DOTALL)
            if text_in_plotly:
                print("✅ Found text data in Plotly!")
                text_content = text_in_plotly.group(1)
                print(f"Text content length: {len(text_content)}")
                
                # Now extract the ride data
                ride_arrays = re.findall(r'\[(.*?)\]', text_content)
                print(f"Found {len(ride_arrays)} ride arrays")
                
                # Process each ride array
                for i, ride_array in enumerate(ride_arrays[:5]):  # Show first 5
                    values = re.findall(r'"([^"]*)"', ride_array)
                    print(f"\nRide {i+1}:")
                    print(f"  Values: {values[:10]}...")
                    
                    # Convert to wait times
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
                    print(f"  Non-null wait times: {non_null_count}")
                    print(f"  First 10 wait times: {wait_times[:10]}")
                    print(f"  Last 10 wait times: {wait_times[-10:]}")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching data: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    debug_data() 