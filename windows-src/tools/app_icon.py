"""Build the original SP Windows app and installer icon."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICON_SOURCE = ROOT / 'web/assets/sp-logo.png'
ICON_SIZES = (16, 24, 32, 48, 64, 128, 256)


def build_windows_icon(destination=None):
    from PIL import Image
    destination = Path(destination) if destination else ROOT / 'desktop/windows/assets/icon.ico'
    with Image.open(ICON_SOURCE) as image:
        # Retain the original Windows composition and its dark backdrop.
        logo = image.convert('RGBA')
        logo.thumbnail((224, 224))
        artwork = Image.new('RGBA', (256, 256), (25, 20, 25, 255))
        artwork.alpha_composite(logo, ((256-logo.width)//2, (256-logo.height)//2))
        destination.parent.mkdir(parents=True, exist_ok=True)
        artwork.save(destination, format='ICO', sizes=[(size, size) for size in ICON_SIZES])
    with Image.open(destination) as result:
        if result.ico.sizes() != {(size, size) for size in ICON_SIZES}:
            raise ValueError('The Windows icon does not contain every required resolution.')
    return destination


if __name__ == '__main__':
    print(build_windows_icon())
