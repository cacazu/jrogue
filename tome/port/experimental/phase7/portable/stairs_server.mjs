// SPDX-License-Identifier: GPL-3.0-or-later
import {createPhase7Server} from './profile_server.mjs';
export function createTomeServer(options={}){return createPhase7Server('stairs',options);}
