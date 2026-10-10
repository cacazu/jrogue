// SPDX-License-Identifier: GPL-3.0-or-later
import {createProfileServer} from './profile_server.mjs';
export const createTomeServer=options=>createProfileServer('semantic',options);
