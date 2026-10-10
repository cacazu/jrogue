program DrlWasiFilesystemProbe;
{$mode objfpc}{$H+}

uses Classes, SysUtils;
function LinkerStackLow:Pointer;cdecl;external name 'drl_probe_stack_low';

const
  OriginalPath = '/user/probe.sav';
  RenamedPath = '/user/probe-renamed.sav';
  ReadOnlyPath = '/data/probe.dat';
  Payload: array[0..7] of Byte = ($44, $52, $4C, 0, $FF, $7F, $80, $23);

procedure Require(Condition: Boolean; FailureCode: LongInt; const Detail: String);
begin
  if not Condition then
  begin
    WriteLn('DRL filesystem probe FAIL ', FailureCode, ': ', Detail);
    Halt(FailureCode);
  end;
end;

procedure RunProbe;
var
  Stream: TFileStream;
  Restored: array[0..7] of Byte;
  Entry: TSearchRec;
  SearchResult: LongInt;
  FoundRenamed, WriteDenied: Boolean;
  Index: Integer;
  ReadOnlyByte: Byte;
begin
  WriteLn('DRL filesystem probe: begin');
  Require(DirectoryExists('/user'), 61, '/user directory is mounted');
  if FileExists(OriginalPath) then
    Require(DeleteFile(OriginalPath), 62, 'remove previous original probe');
  if FileExists(RenamedPath) then
    Require(DeleteFile(RenamedPath), 63, 'remove previous renamed probe');

  WriteLn('DRL filesystem stage: create user file');
  Stream := TFileStream.Create(OriginalPath, fmCreate);
  try
    Stream.WriteBuffer(Payload, SizeOf(Payload));
    Require(Stream.Size = SizeOf(Payload), 64, 'created file size');
    Require(Stream.Seek(0, soBeginning) = 0, 65, 'seek to first byte');
    Stream.ReadBuffer(Restored, SizeOf(Restored));
    for Index := Low(Payload) to High(Payload) do
      Require(Restored[Index] = Payload[Index], 66, 'byte round trip');
    Require(Stream.Seek(-1, soEnd) = SizeOf(Payload) - 1, 67, 'seek from end');
    Stream.ReadBuffer(ReadOnlyByte, 1);
    Require(ReadOnlyByte = Payload[High(Payload)], 68, 'last byte after seek');
  finally
    Stream.Free;
  end;
  Require(FileExists(OriginalPath), 69, 'original absolute path exists');
  Require(RenameFile(OriginalPath, RenamedPath), 70, 'absolute path rename');
  Require(not FileExists(OriginalPath), 71, 'original path removed by rename');
  Require(FileExists(RenamedPath), 72, 'renamed path exists');

  FoundRenamed := False;
  SearchResult := FindFirst('/user/*', faAnyFile, Entry);
  Require(SearchResult = 0, 73, 'FindFirst on mounted directory');
  try
    while SearchResult = 0 do
    begin
      if Entry.Name = 'probe-renamed.sav' then
      begin
        FoundRenamed := True;
        Require(Entry.Size = SizeOf(Payload), 74, 'directory entry file size');
        Require((Entry.Attr and faDirectory) = 0, 75, 'file directory attribute');
      end;
      SearchResult := FindNext(Entry);
    end;
  finally
    FindClose(Entry);
  end;
  Require(FoundRenamed, 76, 'renamed file enumerated');
  WriteLn('DRL filesystem stage: reopen renamed file');
  Stream := TFileStream.Create(RenamedPath, fmOpenRead);
  try
    Require(Stream.Size = SizeOf(Payload), 77, 'reopened file size');
    Stream.ReadBuffer(Restored, SizeOf(Restored));
    for Index := Low(Payload) to High(Payload) do
      Require(Restored[Index] = Payload[Index], 78, 'bytes survived reopen/rename');
  finally
    Stream.Free;
  end;

  Require(FileExists(ReadOnlyPath), 79, 'read-only data fixture exists');
  WriteLn('DRL filesystem stage: read immutable asset');
  Stream := TFileStream.Create(ReadOnlyPath, fmOpenRead);
  try
    Require(Stream.Size > 0, 80, 'data fixture is nonempty');
    Stream.ReadBuffer(ReadOnlyByte, 1);
  finally
    Stream.Free;
  end;
  WriteDenied := False;
  WriteLn('DRL filesystem stage: expected immutable write denial');
  try
    Stream := TFileStream.Create(ReadOnlyPath, fmOpenWrite);
    Stream.Free;
  except
    on E: EFOpenError do WriteDenied := True;
  end;
  Require(WriteDenied, 81, 'read-only data open-for-write is denied');

  Require(DeleteFile(RenamedPath), 82, 'delete renamed absolute path');
  Require(not FileExists(RenamedPath), 83, 'deleted file no longer exists');
  WriteLn('DRL filesystem probe: PASS');
end;

begin
  System.StackBottom:=LinkerStackLow;
  try
    RunProbe;
  except
    on E: Exception do
    begin
      WriteLn('DRL filesystem probe FAIL 84: ', E.ClassName, ': ', E.Message);
      Halt(84);
    end;
  end;
end.
