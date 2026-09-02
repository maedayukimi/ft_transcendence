import { Test, TestingModule } from '@nestjs/testing';
import { AuthControllerTsService } from './auth.controller.ts.service';

describe('AuthControllerTsService', () => {
  let service: AuthControllerTsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthControllerTsService],
    }).compile();

    service = module.get<AuthControllerTsService>(AuthControllerTsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
