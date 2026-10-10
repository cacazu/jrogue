/* SPDX-License-Identifier: GPL-3.0-or-later
 * Standalone fresh-context regression. Uses original cached tgl.h descriptors
 * at identical CPU addresses; never calls game rules, ticks or original draw.
 * Close this diagnostic VM afterwards: GL state is intentionally test-owned.
 */
#include "lua.h"
#include "lauxlib.h"
#include "tgl.h"
#include "tome_main_platform.h"
#include <emscripten/emscripten.h>
#include <stdio.h>
#include <string.h>
extern int current_game;
static GLfloat positions[8],uvs[8]={0,0,0,1,1,1,1,0},colors[16];
static void quad(float origin,float r,float g,float b){
  GLfloat v[8]={origin,origin,origin,origin+16,origin+16,origin+16,origin+16,origin};
  memcpy(positions,v,sizeof(v));
  for(int i=0;i<4;i++){colors[4*i]=r;colors[4*i+1]=g;colors[4*i+2]=b;colors[4*i+3]=1;}
  glVertexPointer(2,GL_FLOAT,0,positions);
  glTexCoordPointer(2,GL_FLOAT,0,uvs);
  glColorPointer(4,GL_FLOAT,0,colors);
  glDrawArrays(GL_QUADS,0,4);
}
EMSCRIPTEN_KEEPALIVE const char *tome_planar_client_array_regression(void){
  static char result[1024];GLubyte first_left[4],first_right[4],second_left[4],second_right[4];
  if(!tome_main_get_state()||current_game!=LUA_NOREF)return NULL;
  glViewport(0,0,64,64);
  glMatrixMode(GL_PROJECTION);glLoadIdentity();glOrtho(0,64,0,64,-1,1);
  glMatrixMode(GL_MODELVIEW);glLoadIdentity();glTranslatef(8,8,0);glScalef(1,1,1);
  glDisable(GL_TEXTURE_2D);glDisable(GL_BLEND);glDisable(GL_DEPTH_TEST);glDisable(GL_CULL_FACE);
  glEnableClientState(GL_VERTEX_ARRAY);glEnableClientState(GL_TEXTURE_COORD_ARRAY);glEnableClientState(GL_COLOR_ARRAY);
  glClearColor(0,0,0,1);glClear(GL_COLOR_BUFFER_BIT);quad(0,1,0,0);
  glReadPixels(16,16,1,1,GL_RGBA,GL_UNSIGNED_BYTE,first_left);
  glReadPixels(48,48,1,1,GL_RGBA,GL_UNSIGNED_BYTE,first_right);
  glClear(GL_COLOR_BUFFER_BIT);quad(32,0,0,1);
  glReadPixels(16,16,1,1,GL_RGBA,GL_UNSIGNED_BYTE,second_left);
  glReadPixels(48,48,1,1,GL_RGBA,GL_UNSIGNED_BYTE,second_right);
  GLenum error=glGetError();
  snprintf(result,sizeof(result),"{\"protocol\":1,\"same_cpu_addresses\":true,\"positions_pointer\":%u,\"uv_pointer\":%u,\"colors_pointer\":%u,\"first_left\":[%u,%u,%u,%u],\"first_right\":[%u,%u,%u,%u],\"second_left\":[%u,%u,%u,%u],\"second_right\":[%u,%u,%u,%u],\"gl_error\":%u}",
    (unsigned)(size_t)positions,(unsigned)(size_t)uvs,(unsigned)(size_t)colors,
    first_left[0],first_left[1],first_left[2],first_left[3],first_right[0],first_right[1],first_right[2],first_right[3],
    second_left[0],second_left[1],second_left[2],second_left[3],second_right[0],second_right[1],second_right[2],second_right[3],error);
  return result;
}
