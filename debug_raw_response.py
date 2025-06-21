import requests
import json

def debug_raw_response():
    """Debug the raw response from Thrill Data to understand the data format"""
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # Fetch the heatmap page for today
        today = '2025-06-20'
        print(f"📊 Fetching heatmap data for {today}...")
        
        heat_map_response = requests.get(
            'https://www.thrill-data.com/waits/graph/quick/parkheat',
            params={
                'id': 243,  # Epic Universe park ID
                'dateStart': today,
                'tag': 'min'
            },
            headers=headers
        )
        heat_map_response.raise_for_status()
        
        page_content = heat_map_response.text
        
        # Try to parse the JSON response
        try:
            data = json.loads(page_content)
            print("✅ Successfully parsed main JSON response")
            print(f"Keys in response: {list(data.keys())}")
            
            if 'plot1' in data:
                plot1_content = data['plot1']
                print(f"\n📊 Plot1 content length: {len(plot1_content)} characters")
                print(f"📊 Plot1 content preview (first 500 chars):")
                print(plot1_content[:500])
                print(f"\n📊 Plot1 content preview (last 500 chars):")
                print(plot1_content[-500:])
                
                # Look for Plotly data
                if 'Plotly.newPlot' in plot1_content:
                    print("\n✅ Found Plotly.newPlot in content")
                    # Find the start of the data
                    plotly_start = plot1_content.find('Plotly.newPlot')
                    if plotly_start != -1:
                        print(f"Plotly.newPlot found at position: {plotly_start}")
                        # Show the context around Plotly.newPlot
                        context_start = max(0, plotly_start - 50)
                        context_end = min(len(plot1_content), plotly_start + 200)
                        print(f"Context around Plotly.newPlot:")
                        print(plot1_content[context_start:context_end])
                else:
                    print("\n❌ No Plotly.newPlot found in content")
            else:
                print("❌ No 'plot1' key found in response")
                
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing main JSON response: {e}")
            print(f"Response preview (first 1000 chars):")
            print(page_content[:1000])
            print(f"\nResponse preview (last 1000 chars):")
            print(page_content[-1000:])
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching data: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    debug_raw_response() 