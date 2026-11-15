# Controller controls

Supports gamepads that the browser exposes with the `standard` mapping, including common Xbox and PlayStation controllers. Connect before or after opening the page, then press a button to expose it to the browser. Unsupported mappings keep touch and keyboard available rather than guessing controls.

| Control (Xbox / PlayStation) | Action |
| --- | --- |
| Left stick | Analog movement |
| Right stick | Look; reduced sensitivity when aiming |
| LT / L2 | Hold to aim |
| RT / R2 | Fire; hold for automatic rifle |
| A / Cross | Jump; start/restart on title screen |
| B / Circle | Toggle crouch |
| X / Square | Reload |
| Y / Triangle | Switch gun |
| RB / R1 | Pick up targeted loot |
| Left stick click | Toggle sprint |
| D-pad up / down | Flashlight / medkit |
| Menu or View / Options or Share | Open/close inventory and pause |
| Inventory D-pad or left stick | Select occupied inventory slots |
| Inventory A / Cross | Use selected consumable |
| Inventory B / Circle | Close |

18% radial stick dead zone, analog movement, nonlinear look response. Menu transitions, tab blur and visibility changes require neutral sticks/buttons before resuming. Disconnecting the active controller opens the paused inventory. Touch or keyboard input reclaims controls, with touch buttons restored on phones.

Browser security may require an initial screen tap to enable sound, even when a controller starts the game. Tests use synthetic standard Gamepad samples; physical Bluetooth hardware and iOS stick feel need device playtesting.
