"""Device preferences, separate from project data and portable backups."""
import math
import re

ACTIONS = ('select','coverage','pen','highlighter','arrow','text','style','continuous',
           'previous','next','zoomIn','zoomOut','newShot','linkShot','renumber','delete','attach','export')
DEFAULT_BINDS = dict(zip(ACTIONS, ('v','c','p','h','a','t','w','Shift+c','[',']','=','-',
                                 'Shift+n','l','r','Delete','Shift+o','Mod+e')))
BIND = re.compile(r'(?:Mod\+)?(?:Alt\+)?(?:Shift\+)?(?:[a-z0-9\[\]=\-]|Arrow(?:Up|Down|Left|Right)|Delete|Backspace|F(?:[1-9]|1[0-2]))')
RESERVED = re.compile(r'(?:Mod\+(?:Shift\+)?[zsyqwxrvacptnfohm]|(?:Shift\+)?F(?:5|10|11)|(?:Shift\+)?Backspace)')
NAVIGATION_TABS = ('workspace','lined','shots','schedule','reports','elements')


def validate_preferences(value):
    if not isinstance(value, dict):
        raise ValueError('Invalid app settings.')
    output = {}
    if 'navigationOrder' in value:
        order = value['navigationOrder']
        if not isinstance(order, list) or len(order) != len(NAVIGATION_TABS) or any(type(tab) is not str for tab in order) or set(order) != set(NAVIGATION_TABS):
            raise ValueError('Tab order must contain each navigation tab exactly once.')
        output['navigationOrder'] = list(order)
    if 'theme' in value:
        if value['theme'] not in ('light', 'dark'):
            raise ValueError('Choose Light or Dark appearance.')
        output['theme'] = value['theme']
    if 'linedLabelOpacity' in value:
        opacity = value['linedLabelOpacity']
        if type(opacity) not in (int, float) or not math.isfinite(opacity) or not .15 <= opacity <= 1:
            raise ValueError('Information box opacity must be from 15% to 100%.')
        output['linedLabelOpacity'] = opacity
    if 'linedKeyBinds' in value:
        bindings = value['linedKeyBinds']
        if not isinstance(bindings, dict) or set(bindings) - set(ACTIONS):
            raise ValueError('Invalid Lined Script actions.')
        bindings = dict(DEFAULT_BINDS, **bindings)
        seen = set()
        for binding in bindings.values():
            if not isinstance(binding, str) or (binding and (not BIND.fullmatch(binding) or RESERVED.fullmatch(binding))):
                raise ValueError('Invalid or reserved keyboard shortcut.')
            if binding and binding in seen:
                raise ValueError('Keyboard shortcuts conflict. Change or clear one binding.')
            if binding:
                seen.add(binding)
        output['linedKeyBinds'] = bindings
    return output
