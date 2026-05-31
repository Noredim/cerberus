import os
import sys
import subprocess

def setup_pillow():
    try:
        from PIL import Image, ImageDraw
        print("Pillow already installed.")
    except ImportError:
        print("Pillow not found. Installing Pillow...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
            print("Pillow successfully installed!")
        except Exception as e:
            print(f"Error installing Pillow: {e}")
            sys.exit(1)

setup_pillow()
from PIL import Image, ImageDraw

def generate_assets():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    logo_path = os.path.join(base_dir, "apps", "web", "public", "cerberus-logo.png")
    
    if not os.path.exists(logo_path):
        print(f"Error: Original logo not found at {logo_path}")
        sys.exit(1)
        
    print(f"Found base logo at: {logo_path}")
    logo = Image.open(logo_path)
    
    # Target folders
    icons_dir = os.path.join(base_dir, "apps", "web", "public", "icons")
    splash_dir = os.path.join(base_dir, "apps", "web", "public", "splash")
    
    os.makedirs(icons_dir, exist_ok=True)
    os.makedirs(splash_dir, exist_ok=True)
    
    # 1. Helper to center scale an image on transparent background
    def create_icon(size, padding_pct=0.1):
        # Create transparent canvas
        canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
        
        # Calculate available size
        max_dim = int(size * (1 - 2 * padding_pct))
        
        # Resize logo maintaining aspect ratio
        logo_aspect = logo.width / logo.height
        if logo_aspect > 1:
            new_w = max_dim
            new_h = int(max_dim / logo_aspect)
        else:
            new_h = max_dim
            new_w = int(max_dim * logo_aspect)
            
        resized_logo = logo.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Paste centered
        x = (size - new_w) // 2
        y = (size - new_h) // 2
        canvas.paste(resized_logo, (x, y), resized_logo if resized_logo.mode == 'RGBA' else None)
        return canvas

    # Generate icon-192
    print("Generating icon-192.png...")
    icon_192 = create_icon(192, padding_pct=0.05)
    icon_192.save(os.path.join(icons_dir, "icon-192.png"), "PNG")
    
    # Generate icon-512
    print("Generating icon-512.png...")
    icon_512 = create_icon(512, padding_pct=0.05)
    icon_512.save(os.path.join(icons_dir, "icon-512.png"), "PNG")
    
    # Generate icon-maskable (needs higher padding so it fits safe area)
    print("Generating icon-maskable.png...")
    icon_maskable = create_icon(512, padding_pct=0.20)
    icon_maskable.save(os.path.join(icons_dir, "icon-maskable.png"), "PNG")
    
    # Generate splash.png (slate background with centered logo)
    print("Generating splash.png...")
    splash_size = 512
    slate_color = (15, 23, 42, 255) # #0F172A
    splash_canvas = Image.new("RGBA", (splash_size, splash_size), slate_color)
    
    # Resize logo to fit nicely in center of splash (e.g. 200px)
    logo_size = 200
    logo_aspect = logo.width / logo.height
    if logo_aspect > 1:
        new_w = logo_size
        new_h = int(logo_size / logo_aspect)
    else:
        new_h = logo_size
        new_w = int(logo_size * logo_aspect)
        
    resized_logo = logo.resize((new_w, new_h), Image.Resampling.LANCZOS)
    x = (splash_size - new_w) // 2
    y = (splash_size - new_h) // 2
    splash_canvas.paste(resized_logo, (x, y), resized_logo if resized_logo.mode == 'RGBA' else None)
    
    splash_canvas.save(os.path.join(splash_dir, "splash.png"), "PNG")
    print("All PWA assets generated successfully!")

if __name__ == "__main__":
    generate_assets()
