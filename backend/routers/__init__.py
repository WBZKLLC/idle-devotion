# Routers package - Modular API endpoints
# Each router handles a specific domain of the application

from . import equipment
from . import economy
from . import stages
from . import admin
from . import campaign
from . import battle
from . import gacha

__all__ = ['equipment', 'economy', 'stages', 'admin', 'campaign', 'battle', 'gacha']
