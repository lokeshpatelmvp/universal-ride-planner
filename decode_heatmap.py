import base64
import io
from PIL import Image
import numpy as np
import requests
import re
from datetime import datetime, timedelta

def decode_heatmap_image():
    """Decode the base64 PNG heatmap image and extract wait time data"""
    
    print("🔍 Decoding Thrill Data Heatmap Image...")
    print("=" * 60)
    
    # Headers to mimic a real browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # Fetch the heatmap page to get the base64 image
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
        
        # Extract the base64 image data
        page_content = heat_map_response.text
        
        # Look for the base64 image data
        base64_pattern = r'data:image/png;base64,([A-Za-z0-9+/=]+)'
        base64_matches = re.findall(base64_pattern, page_content)
        
        if not base64_matches:
            print("❌ No base64 image data found in the response")
            print("Looking for alternative data formats...")
            
            # Try to find Plotly data
            plotly_pattern = r'Plotly\.newPlot\([^,]+,\s*(\[.*?\]),\s*\{'
            plotly_match = re.search(plotly_pattern, page_content, re.DOTALL)
            
            if plotly_match:
                print("Found Plotly data, but it's embedded in JavaScript")
                print("Raw Plotly data preview:")
                print(plotly_match.group(1)[:500] + "...")
            else:
                print("No Plotly data found either")
            
            return
        
        print(f"✅ Found {len(base64_matches)} base64 image(s)")
        
        # Process each base64 image
        for i, base64_data in enumerate(base64_matches):
            print(f"\n🖼️  Processing image {i+1}:")
            
            try:
                # Decode base64 to image
                image_data = base64.b64decode(base64_data)
                image = Image.open(io.BytesIO(image_data))
                
                print(f"Image size: {image.size}")
                print(f"Image mode: {image.mode}")
                
                # Convert to numpy array for analysis
                img_array = np.array(image)
                print(f"Array shape: {img_array.shape}")
                
                # Analyze the image data
                if len(img_array.shape) == 3:  # RGB or RGBA
                    print(f"Color channels: {img_array.shape[2]}")
                    
                    # Show unique colors (wait time levels)
                    unique_colors = np.unique(img_array.reshape(-1, img_array.shape[2]), axis=0)
                    print(f"Unique colors found: {len(unique_colors)}")
                    
                    # Show first few unique colors
                    print("Sample colors (RGB):")
                    for j, color in enumerate(unique_colors[:10]):
                        print(f"  {j}: {color}")
                    
                    # Try to extract wait time data by analyzing color patterns
                    # Each row represents a ride, each column represents a time interval
                    height, width = img_array.shape[:2]
                    print(f"\nHeatmap dimensions: {width} time intervals × {height} rides")
                    
                    # Create a simple color-to-wait-time mapping
                    # This is a rough estimation - we'd need the actual color scale
                    print("\n📈 Estimated wait time data:")
                    print("-" * 40)
                    
                    # For demonstration, let's show the color intensity for each row
                    # (each row represents a different ride)
                    for row in range(min(height, 10)):  # Show first 10 rides
                        row_colors = img_array[row, :, :3]  # RGB values
                        avg_intensity = np.mean(row_colors)
                        print(f"Ride {row+1}: Average intensity = {avg_intensity:.1f}")
                        
                        # Show color pattern for this ride
                        unique_row_colors = np.unique(row_colors.reshape(-1, 3), axis=0)
                        print(f"  Unique colors in row: {len(unique_row_colors)}")
                        
                        # Show first few time intervals
                        first_10_intervals = row_colors[:10]
                        print(f"  First 10 intervals: {[tuple(color) for color in first_10_intervals]}")
                
                else:  # Grayscale
                    print("Grayscale image detected")
                    print(f"Unique values: {np.unique(img_array)}")
                    
                    # Show data for first few rides
                    for row in range(min(img_array.shape[0], 10)):
                        row_data = img_array[row, :]
                        print(f"Ride {row+1}: {row_data[:10]}... (avg: {np.mean(row_data):.1f})")
                
            except Exception as e:
                print(f"❌ Error processing image {i+1}: {e}")
        
        # Also try to extract any text data from the page
        print("\n🔍 Looking for text-based data...")
        
        # Look for ride names
        ride_pattern = r'<td[^>]*>([^<]*Yoshi[^<]*)</td>|<td[^>]*>([^<]*Carousel[^<]*)</td>|<td[^>]*>([^<]*Mario[^<]*)</td>'
        ride_matches = re.findall(ride_pattern, page_content, re.IGNORECASE)
        
        if ride_matches:
            print("Found ride references:")
            for match in ride_matches:
                ride_name = next(name for name in match if name)
                print(f"  - {ride_name}")
        
        # Look for any JSON data
        json_pattern = r'\{[^{}]*"wait"[^{}]*\}'
        json_matches = re.findall(json_pattern, page_content)
        
        if json_matches:
            print(f"Found {len(json_matches)} potential JSON data snippets")
            for j, json_data in enumerate(json_matches[:3]):  # Show first 3
                print(f"  JSON {j+1}: {json_data}")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching data: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def analyze_color_scale():
    """Analyze the color scale to understand wait time mapping"""
    print("\n🎨 Color Scale Analysis:")
    print("-" * 40)
    
    # Common heatmap color scales and their typical wait time mappings
    color_scales = {
        'blue_to_red': {
            'description': 'Blue (low) to Red (high)',
            'typical_mapping': {
                'blue': '5-15 minutes',
                'green': '15-30 minutes', 
                'yellow': '30-60 minutes',
                'orange': '60-90 minutes',
                'red': '90+ minutes'
            }
        },
        'green_to_red': {
            'description': 'Green (low) to Red (high)',
            'typical_mapping': {
                'green': '5-20 minutes',
                'yellow': '20-45 minutes',
                'orange': '45-75 minutes',
                'red': '75+ minutes'
            }
        }
    }
    
    for scale_name, scale_info in color_scales.items():
        print(f"\n{scale_name.upper()}:")
        print(f"  {scale_info['description']}")
        for color, wait_range in scale_info['typical_mapping'].items():
            print(f"  {color}: {wait_range}")

if __name__ == "__main__":
    decode_heatmap_image()
    analyze_color_scale() 